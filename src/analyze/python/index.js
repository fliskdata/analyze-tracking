/**
 * @fileoverview Python analytics tracking analyzer - main entry point
 * @module analyze/python
 */

const fs = require('fs');
const path = require('path');

// Singleton instance of Pyodide
let pyodide = null;

/**
 * Initialize Pyodide runtime lazily
 * 
 * This function loads Pyodide and required Python packages only when needed,
 * improving startup performance when Python analysis is not immediately required.
 * 
 * @returns {Promise<Object>} The initialized Pyodide instance
 * @throws {Error} If Pyodide fails to load
 */
async function initPyodide() {
  if (!pyodide) {
    try {
      const { loadPyodide } = await import('pyodide');
      pyodide = await loadPyodide();
      
      // Pre-load required Python packages
      await pyodide.loadPackagesFromImports('import ast, json');
    } catch (error) {
      throw new Error(`Failed to initialize Pyodide: ${error.message}`);
    }
  }
  return pyodide;
}

/**
 * Analyze a Python file for analytics tracking calls
 * 
 * This function parses Python code and identifies analytics tracking calls from various
 * libraries, extracting event names, properties, and metadata.
 * 
 * @param {string} filePath - Path to the Python file to analyze
 * @param {string} [customFunctionSignature=null] - Signature of a custom tracking function to detect
 * @returns {Promise<Array<Object>>} Array of tracking events found in the file
 * @returns {Promise<Array>} Empty array if an error occurs
 * 
 * @example
 * const events = await analyzePythonFile('./app.py');
 * // Returns: [{ eventName: 'User Signup', source: 'segment', properties: {...}, ... }]
 * 
 * @example
 * // With custom tracking function
 * const events = await analyzePythonFile('./app.py', 'track_event');
 */
async function analyzePythonFile(filePath, customFunctionSignatures = null) {
  // temporary: only support one custom function signature for now, will add support for multiple in the future
  const customConfig = !!customFunctionSignatures?.length ? customFunctionSignatures[0] : null;

  // Validate inputs
  if (!filePath || typeof filePath !== 'string') {
    console.error('Invalid file path provided');
    return [];
  }

  try {
    // Check if file exists before reading
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return [];
    }

    // Read the Python file
    const code = fs.readFileSync(filePath, 'utf8');
    
    // Initialize Pyodide if not already done
    const py = await initPyodide();
    
    // Load the Python analyzer code
    const analyzerPath = path.join(__dirname, 'pythonTrackingAnalyzer.py');
    if (!fs.existsSync(analyzerPath)) {
      throw new Error(`Python analyzer not found at: ${analyzerPath}`);
    }
    
    const analyzerCode = fs.readFileSync(analyzerPath, 'utf8');
    
    // Set up Python environment with necessary variables
    py.globals.set('code', code);
    py.globals.set('filepath', filePath);
    py.globals.set('custom_config_json', customConfig ? JSON.stringify(customConfig) : null);
    py.runPython('import json');
    py.runPython('custom_config = None if custom_config_json == None else json.loads(custom_config_json)');
    // Set __name__ to null to prevent execution of main block
    py.globals.set('__name__', null);
    
    // Load and run the analyzer
    py.runPython(analyzerCode);
    
    // Execute the analysis and parse result
    const result = py.runPython('analyze_python_code(code, filepath, custom_config)');
    const events = JSON.parse(result);
    
    return events;
  } catch (error) {
    // Log detailed error information for debugging
    console.error(`Error analyzing Python file ${filePath}:`, error);
    console.error('Stack trace:', error.stack);
    return [];
  }
}

// Export the public API
module.exports = { 
  analyzePythonFile,
  // Export for testing purposes
  _initPyodide: initPyodide
};
