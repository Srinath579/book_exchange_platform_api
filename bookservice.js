// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

// Create an Express application
const app = express();

// Middleware for parsing JSON requests
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Database connection details
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'BK_EXC_PLT'
});

// Secret key for JWT token generation
const jwtSecret = 'your_jwt_secret';

// Middleware to verify authorization token
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

// Route to create a new book
app.post('/books', verifyToken, async (req, res) => {
  try {
    const {
      title,
      author,
      genre,
      condition,
      availability_status,
      book_image,
      owner_id,
      owner_email_id,
      owner_name
    } = req.body;

    // Insert book into the database
    const [result] = await pool.query(
      'INSERT INTO BOOKS (TITLE, AUTHOR, GENRE, BOOK_CONDITION, AVAILABILITY_STATUS, BOOK_IMAGE, OWNER_ID, OWNER_EMAIL_ID, OWNER_NAME) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, author, genre, condition, availability_status, book_image, owner_id, owner_email_id, owner_name]
    );

    const bookId = result.insertId;

    // Return success response with book ID and link
    const response = {
      message: 'Book created successfully',
      book_id: bookId,
      _links: {
        self: { href: `http://localhost:3002/books/${bookId}` }
      }
    };

    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to get a list of books
app.get('/books', verifyToken, async (req, res) => {
  try {
    // Fetch books from the database
    const [books] = await pool.query('SELECT * FROM BOOKS');

    // Map books to desired format
    const formattedBooks = books.map(book => ({
      book_id: book.BOOK_ID,
      title: book.TITLE,
      author: book.AUTHOR,
      genre: book.GENRE,
      condition: book.BOOK_CONDITION,
      availability_status: book.AVAILABILITY_STATUS,
      _links: {
        self: { href: `http://localhost:3002/books/${book.BOOK_ID}` }
      }
    }));

    // Construct response
    const response = { books: formattedBooks };
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to get a book by ID
app.get('/books/:id', verifyToken, async (req, res) => {
  try {
    const bookId = req.params.id;

    // Fetch book from the database
    let book = await pool.query('SELECT * FROM BOOKS WHERE BOOK_ID = ?', bookId);
    book = book[0][0];

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Fetch owner details
    const [owner] = await pool.query('SELECT OWNER_ID, OWNER_EMAIL_ID, OWNER_NAME FROM BOOKS WHERE BOOK_ID = ?', [bookId]);

    // Construct response
    const response = {
      book_id: book.BOOK_ID,
      title: book.TITLE,
      author: book.AUTHOR,
      genre: book.GENRE,
      condition: book.BOOK_CONDITION,
      availability_status: book.AVAILABILITY_STATUS,
      owner: {
        owner_id: owner.OWNER_ID,
        owner_email_id: owner.OWNER_EMAIL_ID,
        owner_name: owner.OWNER_NAME
      },
      _links: {
        self: { href: `http://localhost:3002/books/${book.BOOK_ID}` },
        collection: { href: 'http://localhost:3002/books' }
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to delete a book by ID
app.delete('/books/:id', verifyToken, async (req, res) => {
  try {
    const bookId = req.params.id;

    // Check if the book exists
    let book = await pool.query('SELECT * FROM BOOKS WHERE BOOK_ID = ?', bookId);

    book = book[0][0];

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Delete the book from the database
    await pool.query('DELETE FROM BOOKS WHERE BOOK_ID = ?', [bookId]);

    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to toggle the availability status of a book by ID
app.put('/books/:id/availability', verifyToken, async (req, res) => {
  try {
    const bookId = req.params.id;

    // Fetch the current availability status of the book
    let book = await pool.query('SELECT AVAILABILITY_STATUS FROM BOOKS WHERE BOOK_ID = ?', bookId);

    book = book[0][0];

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Toggle the availability status
    const newAvailabilityStatus = book.AVAILABILITY_STATUS === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';

    // Update the availability status of the book in the database
    await pool.query('UPDATE BOOKS SET AVAILABILITY_STATUS = ? WHERE BOOK_ID = ?', [newAvailabilityStatus, bookId]);

    res.status(200).json({ message: 'Updated Book Status Successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route for handling unimplemented HTTP methods for '/books' and '/books/:id'
app.use('/books', (req, res, next) => {
  res.status(405).json({ message: 'Method Not Allowed' });
});

// Middleware for handling unimplemented routes
app.use((req, res, next) => {
  res.status(404).json({ message: 'Not Found' });
});

// Start the server
app.listen(3002, () => {
  console.log('Server listening on port 3002');
});
