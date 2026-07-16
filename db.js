 
   const mysql = require('mysql2');
  
   

  // Create a connection pool
  const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD, // This comes from your .env file
  database: process.env.DB_NAME,     // This comes from your .env file
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
  });

  // Convert the pool to use Promises so we can use "await"
  const promisePool = pool.promise();

  module.exports = promisePool;