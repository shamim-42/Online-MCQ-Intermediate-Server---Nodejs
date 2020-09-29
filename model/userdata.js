const mongoose = require("mongoose");

const UserDataSchema = new mongoose.Schema({
    "key": String
})

const UserData = mongoose.model('userData', UserDataSchema)

module.exports = UserData;