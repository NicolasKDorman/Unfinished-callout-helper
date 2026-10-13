// Builds the single shareable file "Callout Helper.html" from src/.
// Run: node tools/build.js   (from the Callout Simulator folder)
'use strict';
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
var html = read('src/page.html');
// Use function replacers so "$" in the code is never treated as a pattern.
html = html.replace('/*ENGINE*/', function () { return read('src/engine.js'); });
html = html.replace('/*APP*/', function () { return read('src/app.js'); });
// The made-up sample schedule rides along so "Try it" works offline. Real schedules never go in the build.
html = html.replace('<!--SAMPLE-->', function () { return '<script type="text/calendar" id="sample-ics">\n' + read('sample/sample-schedule.ics').replace(/<\//g, '<\\/') + '\n</script>'; });
if (html.indexOf('<!--SAMPLE-->') !== -1 || html.indexOf('/*ENGINE*/') !== -1 || html.indexOf('/*APP*/') !== -1) throw new Error('placeholder not replaced');
fs.writeFileSync(path.join(root, 'Callout Helper.html'), html);
console.log('Wrote Callout Helper.html (' + html.length + ' bytes)');
