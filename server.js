const express = require("express");
const http = require("http");
const axios = require("axios");
const Request = require("request");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

const UserData = require("./model/userdata");
const UserExamData = require("./model/userExamData");
const { parse } = require("path");

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
                                        "data": {
                                            "question": selected_question,
                                            "sequence": data.lastSequence + 1
                                        }
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
    let sequenceIncrement = 1;
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
                        $inc: { correctAnswer: correct },
                        $push: { answeredQuestion: question_id },
                        $inc: { lastSequence: sequenceIncrement },

                    }
                ).then((data) => {
                    // console.log(data);
                    // if (!data)
                    //     return res.send(false);
                    // res.send(data);
                })

                //now check whether this answered question was the last question in the exam.
                //if so, save this result in the external server where user-exam data is recored.

                const promise = () => {
                    return new Promise((resolve, reject) => {
                        Request.get(
                            "http://3.17.29.219:8000/api/mcq/question/",
                            (error, response, body) => {
                                let responseData = JSON.parse(body)
                                let all_questions = responseData['data'];

                                let filtered_questions = [];
                                all_questions.forEach(element => {
                                    if (element.fk_exam == data.examId) {
                                        filtered_questions.push(element)
                                    }
                                });

                                resolve(filtered_questions)
                            }
                        );
                    })
                }

                const ks = promise();
                ks.then(result => {
                    UserExamData.findById(params.id).then(info => {
                        // console.log(info)
                        if (result.length == info.answeredQuestion.length) {
                            // both length are equal means all questions have been answered.
                            // we should now save the data.
                            // let theData = {
                            //     "total_question": parseInt(result.length),
                            //     "achieved_marks": parseInt(info.correctAnswer),
                            //     "fk_user": parseInt(info.userId),
                            //     "fk_exam": parseInt(info.examId),
                            //     "status": "completed"
                            // }

                            console.log(info)

                            let theData = {
                                "total_question": parseInt(result.length),
                                "achieved_marks": parseInt(info.correctAnswer),
                                "fk_user": parseInt(info.userId),
                                "fk_exam": parseInt(info.examId),
                                "status": "completed"
                            }
                            // console.log(info)

                            axios({
                                method: "POST",
                                url: "http://3.17.29.219:8000/api/mcq/user-exam/",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                data: theData

                            }).then((ress) => {
                                console.log(ress.data)
                            }).catch(err => {
                                console.log(err)
                            })

                            // axios.post(
                            //     
                            //     theData
                            // ).then((ress) => {
                            //     console.log(ress.data)
                            // }).catch(err => {
                            //     console.log(err)
                            // })

                            // Request.post("http://3.17.29.219:8000/api/mcq/user-exam/", theData, (error, response, body) => {
                            //     console.log(body);
                            //     console.log(response);
                            //     // console.log(error)
                            // })
                        }
                    })
                })


                return res.send({ "message": "successfully saved" });
            }
        })
        .catch((err) => console.log(err));
});




app.listen(4500, function () {
    console.log("server running on port 4500");
});
