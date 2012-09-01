var fs = require('fs');
var files = process.argv.slice(2);
var compress = require('index').compress;

var failed = 0;

files.forEach(function(file) {

  var input = fs.readFileSync(file, 'utf-8');
  var control = fs.readFileSync(file.replace('.in.', '.out.'), 'utf-8').trim();
  var output = compress(input).trim();

  if (output != control) {
    console.log("==> FAIL: "+file);
    console.log("    expected:", control);
    console.log("    actual:  ", output)
    failed += 1;
  }
});

if (failed > 0) {
  console.log("" + failed + " failures.");
  process.exit(1);
} else {
  console.log("OK!");
}
