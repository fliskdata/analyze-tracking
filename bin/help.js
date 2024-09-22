const header =
`                                                                                                                                                                                                                            
\u001b[38;5;2m                  ▒▒                   \u001b[39m                                                                       
\u001b[38;5;2m                 ▒▒▒▒                  \u001b[39m                                                                       
\u001b[38;5;2m                 ▒▒▒▒                  \u001b[39m       ████████  ██████    ██████                   ██████             
\u001b[38;5;2m                 ▒▒▒▒                  \u001b[39m     ██████████  ██████    ██████                   ██████             
\u001b[38;5;2m                ▒▒▒▒▒▒                 \u001b[39m    ███████████  ██████    ██████                   ██████             
\u001b[38;5;2m                ▒▒▒▒▒▒                 \u001b[39m    ██████       ██████                             ██████             
\u001b[38;5;2m               ▒▒▒▒▒▒▒▒                \u001b[39m ██████████████  ██████    ██████     █████████     ██████     ██████  
\u001b[38;5;2m              ▒▒▒▒▒▒▒▒▒▒               \u001b[39m ██████████████  ██████    ██████   █████████████   ██████   ███████   
\u001b[38;5;2m             ▒▒▒▒▒▒▒▒▒▒▒▒              \u001b[39m ██████████████  ██████    ██████  ███████  ████    ██████ ████████    
\u001b[38;5;2m         ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒           \u001b[39m    ██████       ██████    ██████  ████████         █████████████      
\u001b[38;5;2m  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    \u001b[39m    ██████       ██████    ██████   ███████████     ████████████       
\u001b[38;5;2m ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   \u001b[39m    ██████       ██████    ██████     ███████████   █████████████      
\u001b[38;5;2m     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         \u001b[39m    ██████       ██████    ██████          ██████   ███████ ██████     
\u001b[38;5;2m          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             \u001b[39m    ██████       ██████    ██████   ████   ██████   ██████   ██████    
\u001b[38;5;2m             ▓▓▓▓▓▓▓▓▓▓▓▓              \u001b[39m    ██████       ██████    ██████  ██████████████   ██████    ███████  
\u001b[38;5;2m              ▓▓▓▓▓▓▓▓▓▓               \u001b[39m    ██████       ██████    ██████    ██████████     ██████     ███████ 
\u001b[38;5;2m               ▓▓▓▓▓▓▓▓                \u001b[39m                                                                       
\u001b[38;5;2m                ▓▓▓▓▓▓                 \u001b[39m                                                                       
`;

const helpContent = [
  {
    content: header,
    raw: true
  },
  {
    header: '@flisk/analyze-tracking',
    content: 'Automatically document your analytics setup by analyzing tracking code and generating data schemas from tools like Segment, Amplitude, Mixpanel, and more 🚀'
  },
  {
    header: 'Options',
    optionList: [
      {
        name: 'help',
        alias: 'h',
        description: 'Display this usage guide.',
        type: Boolean
      },
      {
        name: 'output',
        alias: 'o',
        description: 'Name of the output file.',
        type: String,
        defaultOption: true,
        typeLabel: '{underline tracking-schema.yaml}'
      },
      {
        name: 'customFunction',
        alias: 'c',
        description: 'Specify a custom tracking function.',
        type: String,
        typeLabel: '{underline yourCustomFunctionName}'
      }
    ]
  },
  {
    header: 'Project Home',
    content: '{underline https://github.com/fliskdata/analyze-tracking}'
  }
];

module.exports = { helpContent };
