const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const serverless = require("serverless-http");

const drawbageRoutes = express.Router();

const PORT = 4000;

const gameUtils = require("./util");
const gameConstants = require("./constants");

const connectURL =
  "mongodb+srv://SuperReadWrite:7Yhl2Nf73qxzyt7Q@cluster0-0k5ii.mongodb.net/Drawbage?retryWrites=true&w=majority";
// /'mongodb://127.0.0.1:27017/todos'
let Game = require("./Game.model");
let Prompt = require("./Prompt.model");

app.use(cors());
app.use(bodyParser.json());


mongoose.connect(connectURL, { useNewUrlParser: true,useUnifiedTopology: true });

const connection = mongoose.connection;

connection.once("open", function () {
  console.log("MongoDB database connection established successfully");
});

//Get all (really just for testing probably)
drawbageRoutes.route("/").get(function (req, res) {
  Game.find(function (err, games) {
    if (err) {
      console.log(err);
    } else {
      res.json(games);
    }
  });
});

//New game
drawbageRoutes.route("/new").post(function (req, res) {
  let game = new Game(req.body);

  game.gameStage = "LOBBY";

  game
    .save()
    .then((game) => {
      res.status(200).json({ game: game });
    })
    .catch((err) => {
      res.status(400).json({ game: "game add failed" });
    });
});

drawbageRoutes.route("/getGame/:id").get(function (req, res) {
  let id = req.params.id;
    
  Game.findById(id, function (err, game) {
    if (err) {
      res.status(404).json({'error':'Game not found for id:'+id});
    } else {          

      const drawingFailed = gameUtils.drawingTimeIsUp(game);
      if(drawingFailed ){
        
        gameUtils.continueFromActiveDrawing(game);
        game.save().then((game)=>{
          res.json(game.toJSON({ virtuals: true }));
        });        
      } else {
        res.json(game.toJSON({ virtuals: true }));
      }
      

      
    }
  
  });
});

drawbageRoutes.route("/joinGame/:id").post(function (req, res) {
  //let game = new Game(req.body);

  let id = req.params.id;

  Game.findById(id, function (err, game) {
    if (err) {
      console.log(err);
      res.status(400).json({ error: "You idiot" });
    } else {
      // Check that we can join this game
      // TODO: check that game is in lobby stage,
      // check that this player name is unique

      game.players.push(req.body);
      game
        .save()
        .then((game) => {
          res
            .status(200)
            .json({
              success: "We've done it",
              playerID: game.players[game.players.length - 1]._id,
            });
        })
        .catch((err) => {
          res.status(400).json({ error: "You idiot" });
        });

      //res.json(game);
    }
  });
});

drawbageRoutes.route("/startGame/:id").post(function (req, res) {
  let id = req.params.id;

  Game.findById(id, function (err, game) {
    if (err) {
      console.log(err);
      res.status(400).json({ error: "You idiot" });
    } else {
      // Check that we can join this game
      if (game.gameStage != "LOBBY") {
        res.status(400).json({ error: "You idiot" });
        return;
      }

      getRandomPrompts(game).then((prompts)=>{

        game.futureRounds = getFutureRounds(game,2,prompts);
        game.activeRound = game.futureRounds.pop();
        game.activeRound.activeDrawing = game.activeRound.futureDrawings.pop();
        game.activeRound.activeDrawing.startTime = (new Date());
  
        game.gameStage = "STARTED";
  
        game
          .save()
          .then((game) => {
            res.status(200).json({ success: "We've done it" });
          })
          .catch((err) => {
            console.log(err);
            res.status(400).json({ error: "You idiot" });
          });
        
      });
      
      

      //res.json(game);
    }
  });
});

drawbageRoutes.route("/continue/:id").post(function (req, res) {
  let id = req.params.id;

  Game.findById(id, function (err, game) {
    if (err) {
      console.log(err);
      res.status(400).json({ error: "You idiot" });
    } else {
      // Check that we can join this game
      if (game.gameStage != "STARTED") {
        res.status(400).json({ error: "You idiot" });
        return;
      }

      //TODO: validate that there is a next thing to do

      gameUtils.continueGameWrapper(game);
      /*
      if(game.activeRound && game.activeRound.futureDrawings.length>0){
        game.activeRound.activeDrawing = game.activeRound.futureDrawings.pop();
        game.activeRound.activeDrawing.startTime = (new Date());
      } else if(game.futureRounds.length>0){
          game.activeRound = game.futureRounds.pop();
          game.activeRound.activeDrawing = game.activeRound.futureDrawings.pop();
          game.activeRound.activeDrawing.startTime = (new Date());
      } else{
        //GAME OVER
        game.gameStage = 'COMPLETED';
      }*/
      
      game
        .save()
        .then((game) => {
          res.status(200).json({ success: "We've done it" });
        })
        .catch((err) => {
          console.log(err);
          res.status(400).json({ error: "You idiot" });
        });

      //res.json(game);
    }
  });
});

  //Updates drawing data but does not submit anything
  drawbageRoutes.route("/updateDrawing/:id").post(function (req, res) {
    let id = req.params.id;

    const newDrawing = req.body;
  
    Game.findById(id, function (err, game) {
      if (err) {
        console.log(err);
        res.status(400).json({ error: "You idiot" });
      } else {

        // Validate that the given drawing makes sense
        //TODO validate that drawing contains correct artist name/id for active drawing
        if(game.activeRound && game.activeRound.activeDrawing && game.activeRound.activeDrawing.artist && game.activeRound.activeDrawing.artist._id==newDrawing.artist._id){
          game.activeRound.activeDrawing.imageData = newDrawing.imageData+"";  
        } else {
          res.status(400).json({ error: "You idiot" });
          return;
        }

        //Update game
        game.activeRound.activeDrawing.imageData = newDrawing.imageData+"";  
        //console.log(newDrawing);

        game
          .save()
          .then((game) => {
            res.status(204).json({ success: "We've done it" });
          })
          .catch((err) => {
            console.log(err);
            res.status(400).json({ error: "You idiot" });
          });
  
        //res.json(game);
      }
    });
  });

  drawbageRoutes.route("/submitGuess/:id").post(function (req, res) {
    let id = req.params.id;

    const newGuess = req.body;
  
    Game.findById(id, function (err, game) {
      if (err) {
        console.log(err);
        res.status(400).json({ error: "You idiot" });
      } else {

        // Validate that the given drawing makes sense
        //TODO validation
        //Check there is an active drawing, check the player is a real player

        //Update game
        const currDrawing = game.activeRound.activeDrawing;

        gameUtils.submitGuessWrapper(game,newGuess);

        const isSolved = currDrawing.isSolved;
        if(isSolved){
          
          gameUtils.continueFromActiveDrawing(game);

        }  
  
        game
          .save()
          .then((game) => {
            res.status(200).json({ success: "We've done it" });
          })
          .catch((err) => {
            console.log(err);
            res.status(400).json({ error: "You idiot" });
          });
  
        //res.json(game);
      }
    });
  });

  // Prompt add
  drawbageRoutes.route("/addPrompt").post(function (req, res) {
    let prompt = new Prompt(req.body);
  
    
  
    prompt
      .save()
      .then((prompt) => {
        res.status(200).json({ prompt: prompt });
      })
      .catch((err) => {
        res.status(400).json({ prompt: "game add failed" });
      });
  });


///

app.use("/drawbage", drawbageRoutes);

app.listen(PORT, function () {
  console.log("Server is running on Port: " + PORT);
});

///// utilities
async function getRandomPrompts(game, roundCount = 2) {
  const playerCount = game.players.length;
  const promptCount = playerCount*roundCount;

  let promptList = [];

  return Prompt.aggregate().sample(promptCount);  

}

function getFutureRounds(game, roundCount = 2,promptList) {
let ct=0;
    //TODO, just some fake stuff for now
  for (let roundI = 0; roundI < roundCount; roundI++) {
    game.futureRounds.push({ drawings: [] });
    for (let pI = 0; pI < game.players.length; pI++) {
      const currPlayer = game.players[pI];
      let newDrawing = {
        artist: { ...currPlayer },
        prompt: promptList[ct++],
        imageData: "",
      };

      game.futureRounds[roundI].futureDrawings.push({ ...newDrawing });

    }
  }

  return game.futureRounds;

  
}

//netlify serverless stuff
app.use('/.netlify/functions/server', drawbageRoutes);  // path must route to lambda
app.use('/', (req, res) => res.sendFile(path.join(__dirname, './index.html')));

//end netlify things

module.exports = app;
module.exports.handler = serverless(app);