const express = require('express');
const mysql = require('mysql2/promise'); // Using promises for cleaner syntax
//const bcrypt = require('bcryptjs'); // For secure password hashing
const jwt = require('jsonwebtoken'); // For generating authentication tokens
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

app.use(bodyParser.json()) // for parsing application/json
app.use(cors());

const saltRounds = 10;


// Replace with your MySQL connection details
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Hanuman@1423',
  database: 'BK_EXC_PLT'
});

// Secret key for generating JWT tokens (replace with a strong secret)
const jwtSecret = 'your_jwt_secret';

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate username presence
    if (!email) {
      return res.status(400).json({ message: 'Username is required' });
    }

    // Connect to MySQL database
    const connection = await pool.getConnection();

    // Find user by username
    const [rows] = await connection.query('SELECT * FROM users WHERE EMAIL_ID = ?', [email]);

    // Release connection
    await connection.release();

    if (!rows.length) {
      return res.status(401).json({ message: 'Account does not exists' });
    }

    const user = rows[0];

    if (password !== user.PASSWORD) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate JWT token with user ID
    const emailid = user.EMAIL_ID;
    const username = user.USER_NAME;
    const payload = { userId: user.USER_NAME };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' }); // Token expires in 1 hour

    res.json({ emailid, username, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Validate username presence
    if (!email) {
      return res.status(400).json({ message: 'Username is required' });
    }

    // Connect to MySQL database
    let connection = await pool.getConnection();

    // Check for existing username (using prepared statement)
    const [existingUser] = await connection.query('SELECT * FROM users WHERE EMAIL_ID = ?', [email]);

    // Release connection
    await connection.release();

    if (existingUser.length) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    // Hash password using bcrypt
    // const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user data (using prepared statement)
    connection = await pool.getConnection();
    let RegDate = new Date();
    const [result] = await connection.query('INSERT INTO users (USER_NAME, EMAIL_ID, PASSWORD, REG_DATE) VALUES (?, ?, ?, ?)', [username, email, password, RegDate.toISOString().slice(0, 19).replace('T', ' ')]);

    // Release connection
    await connection.release();

    res.json({ message: 'Registration successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Protected route (middleware to verify authorization token)
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.userId = decoded.userId; // Attach user ID to the request object
    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

app.get('/protected', verifyToken, (req, res) => {
  // Access protected data or resources here, using req.userId
  res.json({ message: 'Welcome, authorized user!' });
});

app.get('/books', verifyToken, async (req, res) => {

  const emailid = req.headers.emailid;
  try {
    let connection = await pool.getConnection();
    const [books] = await connection.query('SELECT * FROM BOOKS WHERE OWNER_EMAIL_ID!=? AND AVAILABILITY_STATUS=?', [emailid, 'AVAILABLE']);
    await connection.release();
    const allbooks = books;
    res.json({ allbooks });
  }
  catch (err) {

  }
});

app.get('/userbooks', verifyToken, async (req, res) => {

  const emailid = req.headers.emailid;
  try {
    let connection = await pool.getConnection();
    const [books] = await connection.query('SELECT * FROM BOOKS WHERE OWNER_EMAIL_ID=?', [emailid]);
    await connection.release();
    const allbooks = books;
    res.json({ allbooks });
  }
  catch (err) {

  }
});

app.delete('/deleteuserbook', verifyToken, async (req, res) => {
  const bookid = req.headers.bookid;
  try {
    let connection = await pool.getConnection();
    const [books] = await connection.query('DELETE FROM BOOKS WHERE BOOK_ID=?', [bookid]);
    await connection.release();
    res.json({ message: 'Book Deleted Successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/changeavailability', verifyToken, async (req, res) => {

  const bookid = req.headers.bookid;
  try {
    let connection = await pool.getConnection();
    const [books] = await connection.query('SELECT * FROM BOOKS WHERE BOOK_ID=?', [bookid]);
    await connection.release();
    if (books[0].AVAILABILITY_STATUS === 'AVAILABLE') {
      let status = 'UNAVAILABLE';
      await pool.getConnection();
      const [changebookstatus] = await connection.query('UPDATE BOOKS SET AVAILABILITY_STATUS = ? WHERE BOOK_ID=?', [status, bookid]);
      await connection.release();
    }
    else if (books[0].AVAILABILITY_STATUS === 'UNAVAILABLE') {
      let status = 'AVAILABLE';
      await pool.getConnection();
      const [changebookstatus] = await connection.query('UPDATE BOOKS SET AVAILABILITY_STATUS = ? WHERE BOOK_ID=?', [status, bookid]);
      await connection.release();
    }
    res.json({ message: 'Updated Book Status Successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/userrequests', verifyToken, async (req, res) => {
  const { emailid, username } = req.headers;
  try {
    let connection = await pool.getConnection();
    let [userrequests] = await connection.query('SELECT BOOKS.AUTHOR, BOOKS.OWNER_NAME, EXCHANGE.* FROM EXCHANGE INNER JOIN BOOKS WHERE EXCHANGE.REQUESTER_NAME = ? AND EXCHANGE.REQUESTER_EMAIL_ID = ? AND BOOKS.OWNER_EMAIL_ID = EXCHANGE.OWNER_EMAIL_ID AND BOOKS.TITLE = EXCHANGE.BOOK_NAME', [username, emailid]);
    await connection.release();
    res.json({ userrequests });
  } catch (error) {
    console.error('Error in fetching exchange requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/deleterequest', verifyToken, async (req, res) => {
  const { emailid, exchangeid } = req.headers;
  try {
    let connection = await pool.getConnection();
    let [userrequests] = await connection.query('DELETE FROM EXCHANGE WHERE REQUESTER_EMAIL_ID=? AND EXCHANGE_ID=?', [emailid, exchangeid]);
    await connection.release();
    res.json({ message: 'Book Deleted Successfully' });
  } catch (error) {
    console.error('Error in deleting exchange requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/getexchangerequests', verifyToken, async (req, res) => {
  const { emailid } = req.headers;
  try {
    let connection = await pool.getConnection();
    let [exchangerequests] = await connection.query('SELECT BOOKS.AUTHOR, BOOKS.OWNER_NAME, EXCHANGE.* FROM EXCHANGE INNER JOIN BOOKS WHERE EXCHANGE.OWNER_EMAIL_ID = ? AND BOOKS.OWNER_EMAIL_ID = EXCHANGE.OWNER_EMAIL_ID AND BOOKS.TITLE = EXCHANGE.BOOK_NAME', [emailid]);
    await connection.release();
    res.json({ exchangerequests });
  } catch (error) {
    console.error('Error in fetching exchange requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/updateexchangerequest', verifyToken, async (req, res) => {
  const { emailid, exchangeid, updatedstatus } = req.headers;
  try {
    let connection = await pool.getConnection();
    let [exchangerequests] = await connection.query('UPDATE EXCHANGE SET STATUS=? WHERE EXCHANGE_ID=? AND OWNER_EMAIL_ID=?', [updatedstatus, exchangeid, emailid]);
    await connection.release();
    res.json({ message: 'Updated Exchange Request Status Successfully' });
  } catch (error) {
    console.error('Error in updating exchange requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.listen(3000, () => console.log('Server listening on port 3000'));