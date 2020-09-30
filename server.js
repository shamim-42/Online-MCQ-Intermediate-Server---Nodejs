const express = require("express");
const http = require("http");
const Request = require("request");
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

    let fiveMinutesLater = new Date(Date.now() + (300000)) //30 minutes duration



    // console.log(userExamData)
    // const query = userExamData.find({ color: 'white' });

    UserExamData
        .findOne({
            userId: req.body['userId'],
            examId: req.body['examId']
        })
        .then(data => {
            if (data) {
                return (
                    res.send({
                        "staus": false,
                        "message": "This exam has already been given !"
                    })
                )
            }
            else {
                var userExamData = new UserExamData({
                    userId: req.body['userId'],
                    examId: req.body['examId'],
                    endTime: fiveMinutesLater,
                    lastSequence: 0,
                    totalQuestion: 0,
                    correctAnswer: 0,
                    answeredQuestion: []
                });
                userExamData
                    .save()
                    .then(function () {
                        res.send({
                            key: userExamData
                                ._id
                                .toString()
                        });
                    })
                    .catch(err => {
                        console.log(err)
                    })
            }
        })
        .catch(err => {
            console.log(err);
        })
});


app.get("/exam-running/:id", function (req, res) {
    var params = req.params;

    if (!Object.keys(params).length)
        return false;

    UserExamData
        .findById(params.id)
        .then(function (data) {
            if (!data)
                return res.send(false);

            //if exam time is expired the return false
            if (data.endTime < new Date(Date.now())) {
                return res.send({
                    "status": "Error",
                    "message": "Time expired"
                });
            }
            else {
                let userId = data.userId
                let examId = data.examId

                // fetch question from remote application
                Request.get(
                    "http://3.17.29.219:8000/api/mcq/question/",
                    (error, response, body) => {
                        if (error) {
                            console.log('external api call error')
                        }

                        let responseData = JSON.parse(body)
                        let all_questions = responseData['data'];

                        // let all_eligible_questions = [];
                        let filtered_questions = [];
                        all_questions.forEach(element => {
                            if (element.fk_exam == examId) {
                                filtered_questions.push(element)
                            }
                        });

                        let all_questions_answered = false;
                        let flag = true;

                        while (flag == true) {
                            if ((data.answeredQuestion.length == filtered_questions.length)) {
                                //since all the questions have been answered, we don't need to proceed ahead.
                                flag = false;
                                all_questions_answered = true;
                            }
                            else {
                                //now select a random question
                                let selected_question = "";
                                if (filtered_questions.length > 0) {
                                    const randomQuestion = filtered_questions[Math.floor(Math.random() * filtered_questions.length)];
                                    selected_question = randomQuestion;
                                }
                                else {
                                    selected_question = filtered_questions[0]
                                }

                                //check whether the selected question already answered or not
                                if (data.answeredQuestion.includes(selected_question.id)) {
                                    continue;
                                }
                                else {
                                    return res.send({
                                        "status": true,
                                        "message": "New Question to be answered",
                                        "data": selected_question
                                    });
                                }
                            }
                        }


                        if (all_questions_answered == true) {
                            return res.send({
                                "status": true,
                                "message": "exam_done",
                                "data": ""
                            });
                        }

                    });
            }

        })
        .catch((err) => console.log(err))
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
            if (!data)
                return res.send(false);

            //if exam time is expired the return false
            if (data.endTime < new Date(Date.now())) {
                return res.send({
                    "status": "Error",
                    "message": "Time expired"
                });
            }

            if (data.answeredQuestion.includes(question_id)) {
                return res.send({
                    "status": "Error",
                    "message": "Already answered"
                });
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
