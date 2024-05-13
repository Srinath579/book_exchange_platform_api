// Import required modules and set up express app
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'BK_EXC_PLT'
});

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

// Route to create user request
app.post('/userrequests', verifyToken, async (req, res) => {
  try {
    const {
      requester_email,
      requester_name,
      owner_email,
      book_id,
      book_name,
      delivery_method,
      return_date
    } = req.body;

    // Insert the request data into the database
    const [result] = await pool.query(
      `INSERT INTO EXCHANGE (REQUESTER_EMAIL_ID, REQUESTER_NAME, OWNER_EMAIL_ID, BOOK_ID, BOOK_NAME, DELIVERY_METHOD, RETURN_DATE, STATUS) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [requester_email, requester_name, owner_email, book_id, book_name, delivery_method, return_date, 'Requested']
    );

    const request_id = result.insertId;

    // Respond with the success message and request ID
    res.status(201).json({
      message: 'User request created successfully',
      request_id,
      _links: {
        self: { href: `http://localhost:3003/userrequests/${request_id}` }
      }
    });
  } catch (error) {
    console.error('Error creating user request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Route to get user requests
app.get('/userrequests', verifyToken, async (req, res) => {
  try {
    // Retrieve user requests from the database
    const [requests] = await pool.query('SELECT * FROM EXCHANGE');

    // Map the results to the desired format
    const formattedRequests = requests.map(request => ({
      request_id: request.EXCHANGE_ID,
      requester_email: request.REQUESTER_EMAIL_ID,
      requester_name: request.REQUESTER_NAME,
      owner_email: request.OWNER_EMAIL_ID,
      book_id: request.BOOK_ID,
      book_name: request.BOOK_NAME,
      delivery_method: request.DELIVERY_METHOD,
      return_date: request.RETURN_DATE, 
      status: request.STATUS,
      _links: {
        self: { href: `http://localhost:3003/userrequests/${request.EXCHANGE_ID}` }
      }
    }));

    // Respond with the formatted user requests
    res.status(200).json({ requests: formattedRequests });
  } catch (error) {
    console.error('Error retrieving user requests:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Route to delete a user request by ID
app.delete('/userrequests/:id', verifyToken, async (req, res) => {
  try {
    const requestId = req.params.id;

    // Execute a query to check if the request exists before attempting deletion
    let result = await pool.query('SELECT * FROM EXCHANGE WHERE EXCHANGE_ID = ?', requestId);

    result = result[0][0]

    // If the request does not exist, respond with status code 404 (Not Found)
    if (!result) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Execute the DELETE query to remove the request from the database
    await pool.query('DELETE FROM EXCHANGE WHERE EXCHANGE_ID = ?', requestId);

    // Respond with status code 204 (No Content) since the request was successfully deleted
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Route to update a user request by ID
app.put('/userrequests/:id', verifyToken, async (req, res) => {
  try {
    const requestId = req.params.id;
    const updates = req.body;

    // Check if the requested user request exists
    let existingRequest = await pool.query('SELECT * FROM EXCHANGE WHERE EXCHANGE_ID = ?', requestId);

    existingRequest = existingRequest[0][0];

    // If the request does not exist, respond with status code 404 (Not Found)
    if (!existingRequest) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // Construct the SET clause for the SQL query based on the updates object
    const setClause = Object.keys(updates).map(attr => `${attr} = ?`).join(', ');

    // Extract the values from the updates object
    const values = Object.values(updates);

    // Execute a query to update the specified attributes of the request in the database
    await pool.query(
      `UPDATE EXCHANGE 
       SET ${setClause} 
       WHERE EXCHANGE_ID = ?`,
      [...values, requestId]
    );

    // Respond with status code 200 (OK) and a success message
    res.status(200).json({ message: 'Updated Exchange Request Successfully' });
  } catch (error) {
    console.error('Error updating user request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Route to get request details by ID
app.get('/userrequests/:id', verifyToken, async (req, res) => {
  try {
    const requestId = req.params.id;

    // Execute a query to retrieve the details of the request from the database
    const [requestDetails] = await pool.query('SELECT * FROM EXCHANGE WHERE EXCHANGE_ID = ?', requestId);

    // If the request does not exist, respond with status code 404 (Not Found)
    if (requestDetails.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Extract the details of the request
    const {
      EXCHANGE_ID,
      REQUESTER_EMAIL_ID,
      REQUESTER_NAME,
      OWNER_EMAIL_ID,
      BOOK_ID,
      BOOK_NAME,
      DELIVERY_METHOD,
      RETURN_DATE,
      STATUS
    } = requestDetails[0];

    // Construct the response object
    const requestDetailsResponse = {
      request_id: EXCHANGE_ID,
      requester_email: REQUESTER_EMAIL_ID,
      requester_name: REQUESTER_NAME,
      owner_email: OWNER_EMAIL_ID,
      book_id: BOOK_ID,
      book_name: BOOK_NAME,
      delivery_method: DELIVERY_METHOD,
      return_date: RETURN_DATE,
      status: STATUS,
      _links: {
        self: { href: `http://localhost:3003/userrequests/${EXCHANGE_ID}` },
        collection: { href: 'http://localhost:3003/userrequests' }
      }
    };

    // Respond with status code 200 (OK) and the request details
    res.status(200).json(requestDetailsResponse);
  } catch (error) {
    console.error('Error retrieving request details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.use('/userrequests', (req, res, next) => {
  res.status(405).json({ message: 'Method Not Allowed' });
});

app.use((req, res, next) => {
  res.status(404).json({ message: 'Not Found' });
});


// Start the server
app.listen(3003, () => console.log('Server listening on port 3003'));
