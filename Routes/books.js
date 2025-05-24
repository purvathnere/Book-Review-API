const express = require('express');
const { validationResult } = require('express-validator');
const Book = require('../models/Book');
const Review = require('../models/Review');
const auth = require('../middleware/auth');
const { validateBook, validatePagination, validateObjectId } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/books
// @desc    Add a new book
// @access  Private
router.post('/', auth, validateBook, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const bookData = {
      ...req.body,
      addedBy: req.user._id
    };

    const book = new Book(bookData);
    await book.save();
    await book.populate('addedBy', 'username');

    res.status(201).json({
      message: 'Book added successfully',
      book
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.isbn) {
      return res.status(400).json({ message: 'A book with this ISBN already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/books
// @desc    Get all books with pagination and filtering
// @access  Public
router.get('/', validatePagination, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (req.query.author) {
      filter.author = new RegExp(req.query.author, 'i');
    }
    if (req.query.genre) {
      filter.genre = new RegExp(req.query.genre, 'i');
    }

    // Build sort object
    let sort = { createdAt: -1 };
    if (req.query.sortBy) {
      const sortField = req.query.sortBy;
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
      sort = { [sortField]: sortOrder };
    }

    const books = await Book.find(filter)
      .populate('addedBy', 'username')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Book.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      books,
      pagination: {
        currentPage: page,
        totalPages,
        totalBooks: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/books/:id
// @desc    Get book by ID with reviews
// @access  Public
router.get('/:id', validateObjectId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const book = await Book.findById(req.params.id)
      .populate('addedBy', 'username');

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Get paginated reviews
    const reviews = await Review.find({ book: req.params.id })
      .populate('user', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalReviews = await Review.countDocuments({ book: req.params.id });
    const totalPages = Math.ceil(totalReviews / limit);

    res.json({
      book,
      reviews,
      reviewsPagination: {
        currentPage: page,
        totalPages,
        totalReviews,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/books/:id/reviews
// @desc    Add a review to a book
// @access  Private
router.post('/:id/reviews', auth, validateObjectId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Check if user already reviewed this book
    const existingReview = await Review.findOne({
      book: req.params.id,
      user: req.user._id
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this book' });
    }

    const { rating, comment } = req.body;

    const review = new Review({
      book: req.params.id,
      user: req.user._id,
      rating,
      comment
    });

    await review.save();
    await review.populate('user', 'username');

    res.status(201).json({
      message: 'Review added successfully',
      review
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
