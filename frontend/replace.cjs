const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('C:\\Users\\LENOVO\\OneDrive\\Desktop\\Biztask\\frontend\\src');

const replacements = [
    // Buttons
    { pattern: /bg-blue-600 hover:bg-blue-700 text-white[^"]*/g, replacement: "btn-primary" },
    { pattern: /px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700/g, replacement: "btn-primary py-2 px-4" },
    { pattern: /bg-blue-600 text-white hover:bg-blue-700/g, replacement: "btn-primary" },
    { pattern: /bg-blue-600 hover:bg-blue-700 text-white/g, replacement: "btn-primary" },
    
    // Focus rings
    { pattern: /focus:ring-blue-500/g, replacement: "focus:ring-[var(--color-brand-black)]" },
    { pattern: /focus:border-blue-500/g, replacement: "focus:border-[var(--color-brand-black)]" },
    
    // Badges / pills (Status: In Progress -> blueish, change to neutral/info)
    { pattern: /bg-blue-100 text-blue-700/g, replacement: "badge-neutral" },
    { pattern: /bg-yellow-100 text-yellow-700/g, replacement: "badge-warning" },
    { pattern: /bg-gray-100 text-gray-700/g, replacement: "badge-neutral" },
    { pattern: /bg-green-100 text-green-700/g, replacement: "badge-success" },
    { pattern: /bg-red-100 text-red-700/g, replacement: "badge-danger" },
    { pattern: /bg-blue-100 text-blue-800/g, replacement: "badge-info" },

    // Icons / Text colors
    { pattern: /text-blue-600/g, replacement: "text-[var(--color-brand-black)]" },
    { pattern: /text-blue-500/g, replacement: "text-[var(--color-brand-gray-dark)]" },
    { pattern: /text-blue-900/g, replacement: "text-[var(--color-brand-black)]" },
    { pattern: /text-blue-800/g, replacement: "text-[var(--color-brand-gray-dark)]" },
    
    // Hover text
    { pattern: /hover:text-blue-600/g, replacement: "hover:text-[var(--color-brand-black)]" },
    { pattern: /hover:text-blue-700/g, replacement: "hover:text-[var(--color-brand-black)]" },
    { pattern: /hover:text-blue-500/g, replacement: "hover:text-[var(--color-brand-gray-dark)]" },
    
    // Backgrounds
    { pattern: /bg-blue-50/g, replacement: "bg-gray-50" },
    { pattern: /bg-blue-100/g, replacement: "bg-gray-100" },
    { pattern: /border-blue-100/g, replacement: "border-gray-200" },
    
    // Progress bar
    { pattern: /bg-blue-600 h-2/g, replacement: "bg-[var(--color-brand-black)] h-2" },
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    replacements.forEach(({pattern, replacement}) => {
        content = content.replace(pattern, replacement);
    });

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
