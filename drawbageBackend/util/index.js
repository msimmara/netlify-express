const gameConstants = require("../constants");


// Wraps logic to continue game to next relevant state
exports.continueGameWrapper = (game) =>{
  if(game.activeRound){
    if(game.activeRound.activeDrawing){
      continueFromActiveDrawing(game);
    }else if(game.activeRound.futureDrawings.length>0) {
      continueToNextDrawing(game);
    } else {
      continueFromActiveRound(game);
    }
  } else {
    if(game.futureRounds.length>0){
      continueToNextRound(game);
      //Assumes there is definitely a next drawing which should be true in practice at least
      //Keeping these calls to simplify if the future calls for more pre round info on its
      //own page
      continueToNextDrawing(game);
    } else {
      continueToGameOver(game);
    }
  }

  scoreGame(game);

}

const continueToGameOver = (game) =>{
  game.gameStage = 'COMPLETED';
};

const continueToNextRound = (game) =>{
  game.activeRound = game.futureRounds.pop();
};

const continueToNextDrawing = (game)=>{
  game.activeRound.activeDrawing = game.activeRound.futureDrawings.pop();
  game.activeRound.activeDrawing.startTime = (new Date());
};

const continueFromActiveDrawing = (game) => {
  game.activeRound.completedDrawings.push(game.activeRound.activeDrawing);
  game.activeRound.activeDrawing = null;
  /*if (game.activeRound.futureDrawings.length < 1) {
    game.completedRounds.push(game.activeRound);
    game.activeRound = null;
  }*/
}
exports.continueFromActiveDrawing = continueFromActiveDrawing;

const continueFromActiveRound = (game) => {
  if (game.activeRound.futureDrawings.length < 1 && (game.activeRound.activeDrawing === null)) {
    game.completedRounds.push(game.activeRound);
    game.activeRound = null;
  }
} 
exports.continueFromActiveRound = continueFromActiveRound;

exports.drawingTimeIsUp = (game) =>{
  if (game && game.activeRound && game.activeRound.activeDrawing){
    
    let drawing = game.activeRound.activeDrawing;

    drawing.isFailed = (drawing.isOutOfTime && (!drawing.isSolved));
    
    

    return drawing.isFailed;
  }

  return false;
};

const submitGuessWrapper = (game, newGuess) => {
  try {
    const drawing = game.activeRound.activeDrawing;
    updateDrawingGuessWrapper(drawing, newGuess);

    scoreGame(game);
  } catch (err) {}
};

//Returns true if update happened, false if it made no sense to update
// Effect: drawing will have a new guess added if applicable
// Effect: drawing will be marked isSolved:true if guess is correct
// No Effect if drawing is already solved
const updateDrawingGuessWrapper = (drawing, newGuess) => {
  if (drawing.isSolved) {
    return false;
  }

  if (drawing.prompt) {
    if (drawing.prompt.textPrompt) {
      return updateDrawingGuess_text(drawing, newGuess);
    }
  }
  return false; //Default
};

//Will only be called if wrapper function determines it is appropriate
const updateDrawingGuess_text = (drawing, newGuess) => {
  const currTime = new Date().getTime();

  let isGuessCorrect = checkIfGuessCorrect(newGuess,drawing.prompt);
  let guessAdd = { ...newGuess, submitTime: currTime };  

  if (isGuessCorrect) {
    guessAdd.isCorrect = true;
    drawing.isSolved = true;
    drawing.solvedTime = currTime;
  }

  drawing.guesses.push(guessAdd);

  return true;
};

const checkIfGuessCorrect = (guess,prompt) =>{
  const strippedPromptText = prompt.textPrompt.toLowerCase().replace(/\s/g, "");
  const strippedGuessText = guess.guessText.toLowerCase().replace(/\s/g, "");

  // Bug fix: some textPrompts have blanks in list of acceptable answers,
  // Should clean those up too but updating for safety
  if(strippedGuessText===""){
    return false;
  }

  if(strippedGuessText===strippedPromptText){
    return true;
  }

  if(prompt.acceptableAnswers){
    let matchFound = false;

    prompt.acceptableAnswers.forEach((ans)=>{
      matchFound = matchFound || (ans.toLowerCase().replace(/\s/g, "") === strippedGuessText);
    });

    return matchFound;

  }

  return false;

};

//Scoring Functions
const scoreDrawing = (drawing, playerScoresByID) => {
  drawing.guesses.forEach((guess) => {
    if (guess.isCorrect) {
      const elapsedMiliseconds = Math.floor(
        guess.submitTime - drawing.startTime
      );
      const timeBonus =
        gameConstants.GUESSER_MAX_BONUS_SCORE -
        elapsedMiliseconds * gameConstants.GUESSER_BONUS_SCORE_DECAY_PER_MIL;
      guess.score =
        Math.floor(gameConstants.GUESSER_CORRECTGUESS_BASESCORE +
        (timeBonus > 0 ? timeBonus : 0));
        
        playerScoresByID[guess.guesser._id] += guess.score;
    } else {
      guess.score = 0;
    }
  });

  if (drawing.isSolved) {
    const elapsedMiliseconds = Math.floor(
      drawing.solvedTime - drawing.startTime
    );
    const timeBonus =
      gameConstants.ARTIST_MAX_BONUS_SCORE -
      elapsedMiliseconds * gameConstants.ARTIST_BONUS_SCORE_DECAY_PER_MIL;
      
      let artistScoreAdd = Math.floor(gameConstants.ARTIST_CORRECTGUESS_BASESCORE + ((timeBonus>0)?timeBonus:0));

    playerScoresByID[drawing.artist._id] +=artistScoreAdd;
      drawing.artist.score = artistScoreAdd;
  } else {
    drawing.artist.score = 0;
  }
};

const scoreRound = (round, playerScoresByID) => {
  round.completedDrawings.forEach((drawing) => {
    scoreDrawing(drawing,playerScoresByID);
  });
  if (round.activeDrawing) {
    scoreDrawing(round.activeDrawing,playerScoresByID);
  }

  // Currently just a middle man function for the most part,
  // nothing score wise currently stored on the round level
};

const scoreGame = (game) => {
  let playerScoresByID = {};
  game.players.forEach((player) => {
    playerScoresByID[player._id] = 0;
  });

  game.completedRounds.forEach((round) => {
    scoreRound(round, playerScoresByID);
  });

  if (game.activeRound) {
    scoreRound(game.activeRound, playerScoresByID);
  }

  game.players.forEach((player) => {
      player.score = playerScoresByID[player._id];
  });
};

// set exports based on functions meant to be external

// Updaters
exports.updateDrawingGuessWrapper = updateDrawingGuessWrapper;

exports.submitGuessWrapper = submitGuessWrapper;
