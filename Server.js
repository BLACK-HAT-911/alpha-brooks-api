require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const winston = require('winston');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// Logging setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Request logging
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Pairing code endpoint with validation
app.post('/pair',
  [
    body('userId').isString().notEmpty().withMessage('Valid userId is required'),
    body('deviceId').isString().notEmpty().withMessage('Valid deviceId is required'),
    body('code').isString().isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code is required')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`Validation errors: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { userId, deviceId, code } = req.body;
      
      // Here you would typically:
      // 1. Validate the pairing code against your database
      // 2. Generate session tokens
      // 3. Log the pairing event
      
      logger.info(`Pairing attempt: ${userId} with device ${deviceId}`);
      
      // Mock successful pairing response
      res.status(200).json({
        success: true,
        message: 'Device paired successfully',
        pairingToken: 'mock-pairing-token-' + Math.random().toString(36).substring(2, 15),
        expiresIn: 3600
      });
    } catch (error) {
      logger.error(`Pairing error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error during pairing',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.stack}`);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Server startup
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed. Process terminated.');
    process.exit(0);
  });
});

module.exports = server;