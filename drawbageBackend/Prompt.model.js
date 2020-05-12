const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let Prompt = new Schema({
    textPrompt:{
        type:String
    },
    acceptableAnswers:{
        type:Array
    }
});

module.exports = mongoose.model('Prompt',Prompt);