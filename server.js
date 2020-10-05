const express = require("express");
const http = require("http");
const axios = require("axios");
const Request = require("request");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
const BASE_URL = "http://localhost:8000"
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


//////////////////  SOCKET.IO  SERVER //////////////////

const server = require('http').createServer();
const options = { /* ... */ };
const io = require('socket.io')(server, options);

io.on('connection', socket => {
    console.log('client connected')
});

server.listen(5000);
////////////////// END OF SOCKET.IO  SERVER ////////////



///////////////////////////////////  API ENDPOINTS ////////////////
app.post("/begin-exam", function (req, res) {
    var current = new Date(); //'September 30 2020'
    var followingDay = new Date(current.getTime() + 300000); // + 1 day in ms
    let afterFiveMintes = followingDay.toLocaleDateString();

    let fiveMinutesLater = new Date(Date.now() + (300000)) //5 minutes duration

    UserExamData
        .findOne({
            userId: req.body['userId'],
            examId: req.body['examId']
        })
        .then(data => {
            if (data) {
                return (
                    res.send({
                        "status": false,
                        "message": "already_given"
                    })
                )
            }
            else {
                //fetch all questions from the remote server. we need the number of total question.
                let total_q = 0;
                fetch_total_question(req.body['examId'])
                    .then(output => {
                        //fetch the exam. we need some data like, exam duration
                        fetch_exam_detail(req.body['examId'])
                            .then(exm_duration => {
                                total_q = output.length;
                                let all_ques_ids = [];

                                for (let i = 0; i < output.length; i++) {
                                    all_ques_ids.push(output[i].id);
                                }

                                let duration_in_milli_seconds = exm_duration * 60 * 1000 // if duration is 10 minutes. then 10 * 60 = 600 seconds 1== 600 * 1000 = 600000 miliseconds
                                let endingTime = new Date(Date.now() + (duration_in_milli_seconds))

                                var userExamData = new UserExamData({
                                    userId: req.body['userId'],
                                    examId: req.body['examId'],
                                    endTime: endingTime,
                                    examDuration: exm_duration,
                                    lastSequence: 0,
                                    lastSentQuestion: 0,
                                    totalQuestion: total_q,
                                    allQuestionIds: all_ques_ids,
                                    answeredQuestion: [],
                                    selectedAnswer: [],
                                });

                                userExamData
                                    .save()
                                    .then(function () {
                                        let passed_seconds = 0;
                                        let passed_minutes = 0;

                                        setInterval(() => {
                                            passed_seconds++;
                                            if (passed_seconds == 60) {
                                                passed_minutes++;
                                                passed_seconds = 0;
                                            }
                                            io.emit('exam_duration_message', { 'minutes': passed_minutes, 'seconds': passed_seconds });
                                            // io.emit('exam_duration_message', passed_seconds);
                                        }, 1000);


                                        res.send({
                                            key: userExamData
                                                ._id
                                                .toString()
                                        });


                                        res.send({
                                            "status": true,
                                            "message": "exam_key",
                                            "data": {
                                                "key": userExamData._id.toString(),
                                            }
                                        })

                                    })
                                    .catch(err => {
                                        console.log(err)
                                    })
                            })
                            .catch(nah => {
                                console.log('nah')
                            })
                    })
                    .catch(err => {
                        console.log('errrrrr')
                    })
            }
        })
        .catch(err => {
            console.log('err');
        })
});

////////////////////////// Fetching Exam Detail ///////////////////
const fetch_exam_detail = (examId) => {
    return new Promise((resolve, reject) => {
        axios({
            method: "GET",
            url: BASE_URL + "/api/mcq/exam/" + examId
        })
            .then(body => {
                // let responseData = JSON.parse(body.data)
                let exam_duration = body.data.data.duration;

                resolve(exam_duration)
            })
            .catch(err => {
                reject('failed_to_fetch_exam_detail');
            })
    })
}
////////////////////////////  ending  /////////////////////////////////////////////////


////////////////////////// Fetching Total questions of any exam ///////////////////
const fetch_total_question = (examId) => {
    return new Promise((resolve, reject) => {
        axios({
            method: "GET",
            url: BASE_URL + "/api/mcq/question/"
        })
            .then(body => {
                // let responseData = JSON.parse(body.data)
                let all_questions = body.data['data'];

                let filtered_questions = [];
                all_questions.forEach(element => {
                    if (element.fk_exam == examId) {
                        filtered_questions.push(element)
                    }
                });

                resolve(filtered_questions)
            })
            .catch(err => {
                reject('failed_to_fetch_questionset');
            })
    })
}
////////////////////////////ending/////////////////////////////////////////////////

////////////////////////// Fetching a question by id ///////////////////
const fetch_a_question = (question_id) => {
    return new Promise((resolve, reject) => {
        axios({
            method: "GET",
            url: BASE_URL + "/api/mcq/question/" + question_id
        })
            .then(body => {
                // let responseData = JSON.parse(body.data)
                let the_question = body.data['data'];

                resolve(the_question)
            })
            .catch(err => {
                reject('failed_to_fetch_questionset');
            })
    })
}
////////////////////////////ending/////////////////////////////////////////////////



app.get("/exam-running/:id", function (req, res) {
    var params = req.params;

    if (!Object.keys(params).length)
        return res.send({
            "status": false,
            "message": "no_key",
            "data": ""
        });

    UserExamData
        .findById(params.id)
        .then(function (data) {
            if (!data)
                return res.send({
                    "status": false,
                    "message": "key_doesnt_exist",
                    "data": ""
                });

            //if exam time is expired the return false
            if (data.endTime < new Date(Date.now())) {
                return res.send({
                    "status": false,
                    "message": "expired",
                    "data": ""
                });
            }
            else {
                let userId = data.userId
                let examId = data.examId

                ////// fetch question from remote application  /////
                axios({
                    method: "GET",
                    url: BASE_URL + "/api/mcq/question/" + data.lastSentQuestion,
                })
                    .then(responseData => {
                        let question = responseData.data['data'];
                        console.log(question)
                        res.send({
                            "status": true,
                            "message": "qustion_to_answer",
                            "data": {
                                "question": question,
                                "sequence": data.lastSequence
                            }
                        })
                    })
                    .catch(err => {
                        res.send({
                            "status": false,
                            "message": "question_fetching_error",
                            "data": ""
                        })
                    })
                ///// end of fetching /////
            }

        })
});




app.post("/save-answer/:id", function (req, res) {
    var params = req.params;

    let question_id = req.body['questionId']
    // let correct = req.body['correct'];
    let selectedAnswer = req.body['selected']
    let sequenceIncrement = 1;

    if (!Object.keys(params).length)
        return false;


    let existing_data = UserExamData
        .findById(params.id)
        .then(function (data) {
            if (!data)
                return res.send({
                    "status": false,
                    "message": "error"
                });
            //if exam time is expired then return false
            if (data.endTime < new Date(Date.now())) {
                return res.send({
                    "status": false,
                    "message": "time_expired"
                });
            }
            //if already answered then return false
            if (data.answeredQuestion.includes(question_id)) {
                console.log(data)
                return res.send({
                    "status": false,
                    "message": "answered"
                });
            }
            else {
                let questionAnswerMap = {
                    question_id: question_id,
                    selected_answer: selectedAnswer
                }

                // now push the answered_question and selected_answer in the respective arrays
                let answered_ques = data.answeredQuestion;
                answered_ques.push(question_id);

                let selected_ans = data.selectedAnswer;
                selected_ans.push(questionAnswerMap);

                let sequence = data.lastSequence + 1;

                UserExamData.findByIdAndUpdate(
                    params.id,
                    {
                        "selectedAnswer": selected_ans,
                        "answeredQuestion": answered_ques,
                        "lastSequence": sequence,
                        "lastSentQuestion": question_id
                    },
                    (l) => {
                        console.log(l)
                    }
                )
                    .then(info => {
                        console.log('before checking to eval')
                        console.log(info)
                        if (info.allQuestionIds.length == info.answeredQuestion.length) {
                            let theData = {
                                "userId": parseInt(info.userId),
                                "examId": parseInt(info.examId),
                                "selectedAnswer": info.selectedAnswer
                            }

                            //send data to the backend (django) server for evalutaion and by thaking the response show the user his result.
                            console.log(BASE_URL + "/api/answer-evaluation/");
                            console.log('before eval');
                            console.log(theData)
                            axios({
                                method: "POST",
                                url: BASE_URL + "/api/answer-evaluation/",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                data: theData

                            }).then((exam_result) => {
                                console.log(exam_result)
                                res.send({
                                    "status": true,
                                    "message": "exam_result",
                                    "data": exam_result.data.data
                                });
                            }).catch(err => {
                                console.log('evaluation error')
                            })
                            // return res.send({
                            //     "status": true,
                            //     "message": "exam_result",
                            //     "data": 'exam_result'
                            // });
                        }
                        else {

                            //since this is not the last question we should return another random question
                            // fetch question from remote application
                            //when all the questions has been answered compiler can't come to this depth. It gets stuck above
                            // where we check the total question length and answered question length.

                            //select a random question
                            console.log('finding random')
                            let random_question_id = "";
                            let unanswered_questions = data.allQuestionIds.filter(x => !data.answeredQuestion.includes(x));
                            // console.log(unanswered_questions)

                            if (unanswered_questions.length > 1) {
                                random_question_id = unanswered_questions[Math.floor(Math.random() * unanswered_questions.length)];
                            }
                            else {
                                random_question_id = unanswered_questions[0]
                            }

                            console.log('random_question_id: ' + random_question_id);


                            axios({
                                method: "GET",
                                url: BASE_URL + "/api/mcq/question/" + random_question_id
                                // url: BASE_URL + "/api/mcq/question/3"
                            })
                                .then(body => {
                                    let the_question = body.data['data'];

                                    UserExamData.findByIdAndUpdate(data.id, { "lastSentQuestion": random_question_id })
                                        .then((updatedData) => {
                                            return res.send({
                                                "status": true,
                                                "message": "new_question",
                                                "data": {
                                                    "question": the_question,
                                                    "sequence": updatedData.lastSequence
                                                }
                                            });
                                        })
                                        .catch(err => {
                                            console.log('err')
                                        })
                                })
                                .catch(err => {
                                    console.log('err');
                                })
                        }
                    })

            }
        })
        .catch((err) => console.log('the error'));
});





app.get("/get-first-question/:exam_key", (req, res) => {
    let exam_key = req.params['exam_key'];
    UserExamData.findById(exam_key)
        .then((data) => {
            if (!data) {
                return (
                    res.send({
                        "status": false,
                        "message": "exam_not_found",
                        "data": ""
                    })
                )
            }
            else {
                if (data.lastSequence == 0) {
                    fetch_total_question(data.examId)
                        .then(all_questions => {
                            let question_to_return = "";
                            //now select a random question
                            if (all_questions.length > 0) {
                                const randomQuestion = all_questions[Math.floor(Math.random() * all_questions.length)];
                                question_to_return = randomQuestion;

                            }
                            else {
                                question_to_return = all_questions[0]
                            }

                            //now make the 'lastSequence' value equal to one (as this question is the first question).
                            //next time when api call will be happened we will check this if the lastSequence was 1.
                            UserExamData.findByIdAndUpdate(exam_key, { lastSentQuestion: question_to_return.id, lastSequence: 1 })
                                .then(
                                    kk => {
                                        res.send({
                                            "status": true,
                                            "message": "first_question",
                                            "data": {
                                                "question": question_to_return,
                                                "sequence": 1
                                            }
                                        })
                                    }
                                )

                        }
                        )
                }
                else {
                    return (
                        res.send({
                            "status": false,
                            "message": "first_question_already_sent",
                            "data": ""
                        })
                    )
                }

            }
        })
})



app.listen(4500, function () {
    console.log("server running on port 4500");
});
