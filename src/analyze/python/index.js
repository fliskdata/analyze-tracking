/**
 * @fileoverview Python analytics tracking analyzer - main entry point
 * @module analyze/python
 */

const fs = require('fs');
const path = require('path');

// Singleton instance of Pyodide
let pyodide = null;
// Cache indicator to ensure we load pythonTrackingAnalyzer.py only once per process
let pythonAnalyzerLoaded = false;

// Simple mutex to ensure calls into the single Pyodide interpreter are serialized
let pyodideLock = Promise.resolve();

async function withPyodide(callback) {
  // Chain the callback onto the existing lock promise
  const resultPromise = pyodideLock.then(callback, callback);
  // Replace lock with a promise that resolves when current callback finishes
  pyodideLock = resultPromise.then(() => {}, () => {});
  return resultPromise;
}

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
  // Validate inputs
  if (!filePath || typeof filePath !== 'string') {
    console.error('Invalid file path provided');
    return [];
  }

  // Check if file exists before reading
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return [];
  }

  try {
    // Read the Python file only once
    const code = fs.readFileSync(filePath, 'utf8');

    // All interaction with Pyodide must be serialized to avoid race conditions
    const events = await withPyodide(async () => {
      // Initialize Pyodide if not already done
      const py = await initPyodide();

      // Load the analyzer definitions into the Pyodide runtime once
      if (!pythonAnalyzerLoaded) {
        const analyzerPath = path.join(__dirname, 'pythonTrackingAnalyzer.py');
        if (!fs.existsSync(analyzerPath)) {
          throw new Error(`Python analyzer not found at: ${analyzerPath}`);
        }
        const analyzerCode = fs.readFileSync(analyzerPath, 'utf8');
        // Prevent the analyzer from executing any __main__ blocks that expect CLI usage
        py.globals.set('__name__', null);
        py.runPython(analyzerCode);
        pythonAnalyzerLoaded = true;
      }

      // Helper to run analysis with a given custom config (can be null)
      const runAnalysis = (customConfig) => {
        py.globals.set('code', code);
        py.globals.set('filepath', filePath);
        py.globals.set('custom_config_json', customConfig ? JSON.stringify(customConfig) : null);
        py.runPython('import json');
        py.runPython('custom_config = None if custom_config_json == None else json.loads(custom_config_json)');
        const result = py.runPython('analyze_python_code(code, filepath, custom_config)');
        return JSON.parse(result);
      };

      // Prepare config argument (array or null)
      const configArg = Array.isArray(customFunctionSignatures) && customFunctionSignatures.length > 0
        ? customFunctionSignatures
        : null;

      return runAnalysis(configArg);
    });

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
