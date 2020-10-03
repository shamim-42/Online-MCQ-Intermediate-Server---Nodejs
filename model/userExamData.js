const mongoose = require("mongoose");

const UserExamSchema = new mongoose.Schema({
    "userId": Number,
    "examId": Number,
    "endTime": Date,
    "lastSequence": Number,
    "totalQuestion": Number,
    "unnecessary": String,
    "allQuestionIds": [Number],
    "answeredQuestion": [Number],
    "selectedAnswer": [],
    "lastSentQuestion": Number,
})

const UserExamData = mongoose.model('userExamData', UserExamSchema)

module.exports = UserExamData;