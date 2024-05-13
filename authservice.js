const express = require('express');
const mysql = require('mysql2/promise'); // Using promises for cleaner syntax
const jwt = require('jsonwebtoken'); // For generating authentication tokens
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// Replace with your MySQL connection details
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'BK_EXC_PLT'
});

// Secret key for generating JWT tokens (replace with a strong secret)
const jwtSecret = 'your_jwt_secret';

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

// Login API
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM USERS WHERE EMAIL_ID = ? LIMIT 1', [email]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = rows[0];

    // For simplicity, I'm not using bcrypt for password comparison in this example
    if (password !== user.PASSWORD) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generating JWT token
    const token = jwt.sign({ userId: user.USER_ID }, jwtSecret);
    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Registration API
app.post('/register', async (req, res) => {
  const { username, password, email } = req.body;

  try {
    const [existingUsers] = await pool.query('SELECT * FROM USERS WHERE EMAIL_ID = ?', [email]);

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await pool.query('INSERT INTO USERS (USER_NAME, PASSWORD, EMAIL_ID, REG_DATE) VALUES (?, ?, ?, ?)', [username, password, email, currentDate]);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Check authentication API
app.get('/check-auth', verifyToken, (req, res) => {
  res.json({ message: 'Authorized' });
});

// Handle unsupported HTTP methods
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') {
    res.status(405).json({ message: 'Method Not Allowed' });
  } else {
    next(); // Allow OPTIONS requests for CORS preflight
  }
});

// Handle non-existing routes
app.use((req, res, next) => {
  res.status(404).json({ message: 'Not Found' });
});

app.listen(3001, () => console.log('Server listening on port 3001'));
