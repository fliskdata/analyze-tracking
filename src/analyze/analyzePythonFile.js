const fs = require('fs');
const path = require('path');

let pyodide = null;

async function initPyodide() {
  if (!pyodide) {
    const { loadPyodide } = await import('pyodide');
    pyodide = await loadPyodide();
    await pyodide.loadPackagesFromImports('import ast, json');
  }
  return pyodide;
}

async function analyzePythonFile(filePath, customFunction) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const py = await initPyodide();
    
    // Read the Python analyzer code
    const analyzerPath = path.join(__dirname, 'pythonTrackingAnalyzer.py');
    const analyzerCode = fs.readFileSync(analyzerPath, 'utf8');
    
    // Add file content and analyzer code to Python environment
    py.globals.set('code', code);
    py.globals.set('filepath', filePath);
    py.globals.set('custom_function', customFunction || null);
    
    // Run the Python analyzer
    py.runPython(analyzerCode);
    const result = py.runPython('analyze_python_code(code, filepath, custom_function)');
    const events = JSON.parse(result);
    
    return events;
  } catch (error) {
    console.error(`Error analyzing Python file ${filePath}:`, error);
    return [];
  }
}

module.exports = { analyzePythonFile };
