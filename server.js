const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

const UserData = require("./model/userdata");
const UserExamData = require("./model/userExamData");

mongoose.Promise = global.Promise;

mongoose.connect("mongodb://localhost/testUser", {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
mongoose
    .connection
    .once("open", function () {
        console.log("mongo db connection successful");
    })
    .on("error", function (err) {
        console.log(err);
    });

app.use(cors());
app.use(bodyParser.json());

app.delete("/user-data/:id", function (req, res) {
    var params = req.params;

    if (!Object.keys(params).length)
        return false;

    UserData
        .findByIdAndRemove(params.id)
        .then(function (data) {
            if (!data)
                return res.send(false);
            res.send(data);
        })
        .catch((err) => console.log(err));
});

///////////////////////////////////
app.post("/begin-exam", function (req, res) {
    var current = new Date(); //'September 30 2020'
    var followingDay = new Date(current.getTime() + 300000); // + 1 day in ms
    let afterFiveMintes = followingDay.toLocaleDateString();

    let fiveMinutesLater = new Date(Date.now() + (300000))


    var userExamData = new UserExamData({
        userId: req.body['userId'],
        examId: req.body['examId'],
        endTime: fiveMinutesLater,
        lastSequence: 0,
        totalQuestion: 0,
        correctAnswer: 0,
        answeredQuestion: []
    });

    // console.log(userExamData)

    userExamData
        .save()
        .then(function () {
            console.log("done");
            res.send({
                key: userExamData
                    ._id
                    .toString()
            });
        })
        .catch(err => {
            console.log(err)
        })
});


app.get("/exam-running/:id", function (req, res) {
    var params = req.params;

    if (!Object.keys(params).length)
        return false;

    UserExamData.findByIdAndUpdate(
        params.id,
        {
            $inc: { lastSequence: 1 }
        }
    ).then((data) => {
        // console.log(data);
        // if (!data)
        //     return res.send(false);
        // res.send(data);
    })


    UserExamData
        .findById(params.id)
        .then(function (data) {
            if (!data)
                return res.send(false);
            res.send(data);
        })
        .catch((err) => console.log(err));
});


app.post("/save-answer/:id", function (req, res) {
    var params = req.params;

    let question_id = req.body['questionId']
    let correct = req.body['correct']

    if (!Object.keys(params).length)
        return false;

    //if the question already answered then ignore it to save
    let existing_data = UserExamData
        .findById(params.id)
        .then(function (data) {
            console.log(data.answeredQuestion)
            if (!data)
                return res.send(false);
            if (data.answeredQuestion.includes(question_id)) {
                return res.send(false);
            }
            else {
                UserExamData.findByIdAndUpdate(
                    params.id,
                    {
                        $inc: { lastSequence: 1 },
                        $inc: { correctAnswer: correct },
                        $push: { answeredQuestion: question_id },
                    }
                ).then((data) => {
                    // console.log(data);
                    // if (!data)
                    //     return res.send(false);
                    // res.send(data);
                })


                UserExamData
                    .findById(params.id)
                    .then(function (data) {
                        // console.log(data)
                        if (!data)
                            return res.send(false);
                        res.send(data);
                    })
                    .catch((err) => console.log(err));
            }
        })
        .catch((err) => console.log(err));

    // UserExamData.findByIdAndUpdate(
    //     params.id,
    //     {
    //         $inc: { lastSequence: 1 },
    //         $inc: { correctAnswer: correct },
    //         $push: { answeredQuestion: question_id },
    //     }
    // ).then((data) => {
    //     // console.log(data);
    //     // if (!data)
    //     //     return res.send(false);
    //     // res.send(data);
    // })


    // UserExamData
    //     .findById(params.id)
    //     .then(function (data) {
    //         console.log(data)
    //         if (!data)
    //             return res.send(false);
    //         res.send(data);
    //     })
    //     .catch((err) => console.log(err));
});




app.listen(4500, function () {
    console.log("server running on port 4500");
});
