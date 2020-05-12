const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const gameUtils = require('./util');
const gameConstants = require('./constants');

// This is defined in Prompt.model.js but importing wonked out for me becuase I'm dumb
let PromptSchema = new Schema({
    textPrompt:{
        type:String
    },
    acceptableAnswers:{
        type:Array
    }
});

// end of prompt def

let PlayerSchema = new Schema({
    name:{
        type:String
    },
    score:{
        type:String
    }
});

let GuessSchema = new Schema({
    guessText:{
        type:String
    },
    guesser:PlayerSchema,
    submitTime:{
        type:Number
    },
    score:{
        type:Number
    },
    isCorrect:{
        type:Boolean
    }
});

let DrawingSchema = new Schema({
    artist:PlayerSchema,
    prompt:PromptSchema,
    imageData:{
        type: String
    },
    guesses:[GuessSchema],
    isSolved:{
        type:Boolean
    },
    isFailed:{
        type:Boolean
    },
    startTime:{
        type:Date
    },
    solvedTime:{
        type:Number
    },
    artistScore:{
        type:Number
    }
});

let RoundSchema = new Schema({
    completedDrawings:[DrawingSchema],
    activeDrawing:DrawingSchema,
    futureDrawings:[DrawingSchema]
});

let Game = new Schema({
    gameCode: {
        type: String
    },
    gameStage:{
        type:String,
        enum: ['LOBBY','STARTED','COMPLETED','CANCELED'],

    },
    owner:[PlayerSchema],
    players:[PlayerSchema],
    completedRounds:[RoundSchema],
    activeRound:RoundSchema,
    futureRounds:[RoundSchema],
    
});

//Add game virtuals
//Game.virtual().get(function(){});;
DrawingSchema.virtual('elapsedMilliseconds').get(function(){
    return (new Date()) - this.startTime;
});

DrawingSchema.virtual('isOutOfTime').get(function(){
    return this.elapsedMilliseconds>gameConstants.DEFAULT_MAX_TIME_MIL;
});

DrawingSchema.virtual('maxPossibleGuesserScore').get(function(){
    const timeBonusPotential = (gameConstants.GUESSER_MAX_BONUS_SCORE-gameConstants.GUESSER_BONUS_SCORE_DECAY_PER_MIL*this.elapsedMilliseconds);
    return gameConstants.GUESSER_CORRECTGUESS_BASESCORE + (timeBonusPotential>0?timeBonusPotential:0);
});

DrawingSchema.virtual('maxPossibleArtistScore').get(function(){
    const timeBonusPotential = (gameConstants.ARTIST_MAX_BONUS_SCORE-gameConstants.ARTIST_BONUS_SCORE_DECAY_PER_MIL*this.elapsedMilliseconds);
    return gameConstants.ARTIST_CORRECTGUESS_BASESCORE + (timeBonusPotential>0?timeBonusPotential:0);
});

DrawingSchema.virtual('winnerName').get(function(){
    let winningGuess = null;
  this.guesses.forEach(g => {
    if(g.isCorrect && winningGuess===null){
      winningGuess = g;
    }
  });

  return (winningGuess)?winningGuess.guesser.name:"None";
});

DrawingSchema.virtual('winnerScore').get(function(){

    let winningGuess = null;
  this.guesses.forEach(g => {
    if(g.isCorrect && winningGuess===null){
      winningGuess = g;
    }
  });

  return (winningGuess)?winningGuess.score:0;
});

module.exports = mongoose.model('Game',Game);