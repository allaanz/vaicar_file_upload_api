var express = require('express');
var app = express();
var multer = require('multer');
var morgan = require('morgan');
var mysql = require('mysql');
var cors = require('cors');
var cookieParser = require('cookie-parser');

// set up our express application
app.use(morgan('dev'));
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use("/uploads", express.static(__dirname + '/uploads'));

var db = mysql.createPool({
  host     : process.env.MYSQL_HOST,
  user     : process.env.MYSQL_USER,
  password : process.env.MYSQL_PASSWORD,
  database : process.env.MYSQL_DATABASE
});

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
    	cb(null, process.env.UPLOAD_DEST)
    },
    filename: (req, file, cb) => {
    	var filename = `${req.body.owner}-${Date.now()}-${file.originalname}`;
		cb(null, filename)
    }
});
var upload = multer({storage: storage});

var range = (start, end) => Array.from({length: (end - start + 1)}, (v, k) => k + start);

app.get('/file/:id', (req, res) => {
	var query = "SELECT path, owner, description FROM files WHERE id = ?";
	db.query(query, [req.params.id], (err, rows, fields) => {
		if(err){
			return res.status(500).send({error: err});
		}
		file = rows[0];
		if(file){
			return res.send({
				url: process.env.UPLOAD_DEST + file.path,
				owner: file.owner,
				description: file.description
			});
		}
		return res.status(500).send({error: "File not found"});
	});
});

app.post('/upload', upload.array('images'), (req, res) => {
	var values = req.files.map(file => [
		file.path, 
		file.destination, 
		file.encoding, 
		file.fieldname, 
		file.filename, 
		file.mimetype, 
		file.originalname, 
		file.size, 
		req.body.owner, 
		req.body.description
	]);
	var query = "INSERT INTO files(path, destination, encoding, fieldname, filename, mimetype, originalname, size, owner, description) VALUES ?";
	db.query(query, [values], (err, result) => {
		if(err){
			return res.status(500).send({error: err});
		}
		
		// MySQL only returns the first inserted row id and the number of inserted rows,
		firstId = result.insertId;
		lastId = result.insertId + result.affectedRows - 1;
		ids = range(firstId, lastId);
		
		// Creating a array with the urls
		urls = ids.map(id => process.env.CLIENT_SIDE_URL+'/gallery/'+id);

		return res.send({ urls: urls });
	});
});


module.exports = app;