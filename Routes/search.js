const express = require('express');
const { validationResult } = require('express-validator');
const Book = require('../models/Book');
const { validatePagination } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/search
// @desc    Search books by title or author
// @access  Public
router.get('/', validatePagination, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { q, page = 1, limit = 10 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        message: 'Search query must be at least 2 characters long'
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Create search query - case insensitive partial match
    const searchRegex = new RegExp(q.trim(), 'i');
    const searchQuery = {
      $or: [
        { title: searchRegex },
        { author: searchRegex }
      ]
    };

    const books = await Book.find(searchQuery)
      .populate('addedBy', 'username')
      .sort({ averageRating: -1, totalReviews: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Book.countDocuments(searchQuery);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      query: q,
      books,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalResults: total,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
