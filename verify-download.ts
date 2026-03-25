
import http from 'http';
import fs from 'fs';

const file = fs.createWriteStream("downloaded_test.zip");
const request = http.get("http://localhost:3000/api/download-dist", function(response) {
  response.pipe(file);
  file.on('finish', function() {
    file.close(() => {
        const stats = fs.statSync("downloaded_test.zip");
        console.log("Downloaded zip size:", stats.size);
    });
  });
});
