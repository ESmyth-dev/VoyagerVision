const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const mineflayer = require("mineflayer");


const minecraftData = require('minecraft-data')
// or for es6: import minecraftData from 'minecraft-data';

const mcData = minecraftData('1.19')
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const skills = require("./lib/skillLoader");
const { initCounter, getNextTime } = require("./lib/utils");
const obs = require("./lib/observation/base");
const OnChat = require("./lib/observation/onChat");
const OnError = require("./lib/observation/onError");
const { Voxels, BlockRecords } = require("./lib/observation/voxels");
const Status = require("./lib/observation/status");
const Inventory = require("./lib/observation/inventory");
const OnSave = require("./lib/observation/onSave");
const Chests = require("./lib/observation/chests");
const { plugin: tool } = require("mineflayer-tool");

const { Viewer, WorldView, getBufferFromStream } = require('prismarine-viewer').viewer
global.Worker = require('worker_threads').Worker
const THREE = require('three')
const { createCanvas } = require('node-canvas-webgl/lib')
const fsp = require('fs').promises
const { Vec3 } = require('vec3')
const { EventEmitter } = require('events')


let bot = null;

var currentdate = new Date();
var month = currentdate.getMonth() + 1
var month_string;
if (month < 10){
    month_string=`0${month}`
} else{
    month_string = `${month}`
}

var minute = currentdate.getMinutes()
var minute_string;
if (minute < 10){
    minute_string=`0${minute}`
} else{
    minute_string = `${minute}`
}

var date = currentdate.getDate()
var date_string;
if (date < 10){
    date_string=`0${date}`
} else{
    date_string = `${date}`
}

var hour = currentdate.getHours()
var hour_string;
if (hour < 10){
    hour_string=`0${hour}`
} else{
    hour_string = `${hour}`
}

var second = currentdate.getSeconds()
var second_string;
if (second < 10){
    second_string=`0${second}`
} else{
    second_string = `${second}`
}

var datetime =`${currentdate.getFullYear()}${month_string}${date_string}-${hour_string}${minute_string}${second_string}`;


const app = express();

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: false }));

app.post("/start", (req, res) => {
    if (bot) onDisconnect("Restarting bot");
    bot = null;
    console.log(req.body);
    bot = mineflayer.createBot({
        host: "localhost", // minecraft server ip
        port: req.body.port, // minecraft server port
        username: "bot",
        disableChatSigning: true,
        checkTimeoutInterval: 60 * 60 * 1000,
        version: "1.19"
    });
    bot.once("error", onConnectionFailed);

    // Event subscriptions
    bot.waitTicks = req.body.waitTicks;
    bot.globalTickCounter = 0;
    bot.stuckTickCounter = 0;
    bot.stuckPosList = [];
    bot.iron_pickaxe = false;

    bot.on("kicked", onDisconnect);

    // mounting will cause physicsTick to stop
    bot.on("mount", () => {
        bot.dismount();
    });

    bot.loadPlugin(pathfinder)

    bot.once("spawn", async () => {
        await bot.waitForChunksToLoad()
        bot.removeListener("error", onConnectionFailed);
        let itemTicks = 1;
        if (req.body.reset === "hard") {
            bot.chat("/clear @s");
            bot.chat("/kill @s");
            const inventory = req.body.inventory ? req.body.inventory : {};
            const equipment = req.body.equipment
                ? req.body.equipment
                : [null, null, null, null, null, null];
            for (let key in inventory) {
                bot.chat(`/give @s minecraft:${key} ${inventory[key]}`);
                itemTicks += 1;
            }
            const equipmentNames = [
                "armor.head",
                "armor.chest",
                "armor.legs",
                "armor.feet",
                "weapon.mainhand",
                "weapon.offhand",
            ];
            for (let i = 0; i < 6; i++) {
                if (i === 4) continue;
                if (equipment[i]) {
                    bot.chat(
                        `/item replace entity @s ${equipmentNames[i]} with minecraft:${equipment[i]}`
                    );
                    itemTicks += 1;
                }
            }
        }

        if (req.body.position) {
            bot.chat(
                `/tp @s ${req.body.position.x} ${req.body.position.y} ${req.body.position.z}`
            );
        }

        // if iron_pickaxe is in bot's inventory
        if (
            bot.inventory.items().find((item) => item.name === "iron_pickaxe")
        ) {
            bot.iron_pickaxe = true;
        }

        const { pathfinder } = require("mineflayer-pathfinder");
        const tool = require("mineflayer-tool").plugin;
        const collectBlock = require("mineflayer-collectblock").plugin;
        const pvp = require("mineflayer-pvp").plugin;
        // const minecraftHawkEye = require("minecrafthawkeye");
        bot.loadPlugin(pathfinder);
        bot.loadPlugin(tool);
        bot.loadPlugin(collectBlock);
        bot.loadPlugin(pvp);
        // bot.loadPlugin(minecraftHawkEye);

        bot.collectBlock.movements.digCost = 0
        bot.collectBlock.movements.placeCost = 0;
        bot.collectBlock.movements.blocksToAvoid.add(mcData.blocksByName["spruce_planks"].id)
        bot.collectBlock.movements.blocksCantBreak.add(mcData.blocksByName["spruce_planks"].id)

        obs.inject(bot, [
            OnChat,
            OnError,
            Voxels,
            Status,
            Inventory,
            OnSave,
            Chests,
            BlockRecords,
        ]);
        skills.inject(bot);

        if (req.body.spread) {
            bot.chat(`/spreadplayers ~ ~ 0 300 under 80 false @s`);
            await bot.waitForTicks(bot.waitTicks);
        }

        await bot.waitForTicks(bot.waitTicks * itemTicks);
        let curr_observation = bot.observe();
        const camera = new Camera(bot)
        camera.on('ready', async () => {
            const yaw = bot.entity.yaw; // Horizontal rotation (radians)
            const pitch = bot.entity.pitch; // Vertical rotation (radians)

            // Convert bot's rotation to camera coordinates
            const lookDirection = new THREE.Vector3(
                -Math.sin(yaw) * Math.cos(pitch), // Flip X
                   Math.sin(pitch),                // Y stays flipped (Minecraft uses positive downward)
                -Math.cos(yaw) * Math.cos(pitch) // Flip Z
            );
        await camera.takePicture(lookDirection, `${datetime}bot_pov`)

        await camera.takePicture(lookDirection, `${datetime}bot_pov`)


            const imageBuffer = fs.readFileSync(`./screenshots/${datetime}bot_pov.jpg`);
        const imageBase64 = imageBuffer.toString('base64');
        //fs.unlinkSync("./screenshots/bot_pov.jpg")

        let json_observation = JSON.parse(curr_observation);

        let blocksPlaced = 0;

        bot.on('blockPlaced', (block) => {
          blocksPlaced++;
          console.log(`Block placed at ${block.position}. Total blocks placed: ${blocksPlaced}`);
        });

            json_observation[0][1]["image"] = imageBase64;


        const new_observation = JSON.stringify(json_observation);


        res.json(new_observation);
  })

        initCounter(bot);
        bot.chat("/gamerule keepInventory true");
        bot.chat("/gamerule doDaylightCycle false");
    });

    function onConnectionFailed(e) {
        console.log(e);
        bot = null;
        res.status(400).json({ error: e });
    }
    function onDisconnect(message) {
        if (bot.viewer) {
            bot.viewer.close();
        }
        bot.end();
        console.log(message);
        bot = null;
    }
});

app.post("/step", async (req, res) => {
    // import useful package
    let response_sent = false;
    function otherError(err) {
        console.log("Uncaught Error");
        bot.emit("error", handleError(err));
        bot.waitForTicks(bot.waitTicks).then(() => {
            if (!response_sent) {
                response_sent = true;
                let curr_observation = bot.observe();
        const camera = new Camera(bot)
        camera.on('ready', async () => {
            const yaw = bot.entity.yaw; // Horizontal rotation (radians)
            const pitch = bot.entity.pitch; // Vertical rotation (radians)

            // Convert bot's rotation to camera coordinates
            const lookDirection = new THREE.Vector3(
                -Math.sin(yaw) * Math.cos(pitch), // Flip X
                   Math.sin(pitch),                // Y stays flipped (Minecraft uses positive downward)
                -Math.cos(yaw) * Math.cos(pitch) // Flip Z
            );
        await camera.takePicture(lookDirection, `${datetime}bot_pov`)

            const imageBuffer = fs.readFileSync(`./screenshots/${datetime}bot_pov.jpg`);
        const imageBase64 = imageBuffer.toString('base64');
        //fs.unlinkSync("./screenshots/bot_pov.jpg")



        let json_observation = JSON.parse(curr_observation);
        for (let i = 0; i < json_observation.length; i++) {
                if (json_observation[i][0] === "observe"){
                    json_observation[i][1]["image"] = imageBase64;
                    console.log("inserting image!")
                }
            }


        const new_observation = JSON.stringify(json_observation);

        res.json(new_observation);
  })
            }
        });
    }

    process.on("uncaughtException", otherError);

    const mcData = require("minecraft-data")(bot.version);
    mcData.itemsByName["leather_cap"] = mcData.itemsByName["leather_helmet"];
    mcData.itemsByName["leather_tunic"] =
        mcData.itemsByName["leather_chestplate"];
    mcData.itemsByName["leather_pants"] =
        mcData.itemsByName["leather_leggings"];
    mcData.itemsByName["leather_boots"] = mcData.itemsByName["leather_boots"];
    mcData.itemsByName["lapis_lazuli_ore"] = mcData.itemsByName["lapis_ore"];
    mcData.blocksByName["lapis_lazuli_ore"] = mcData.blocksByName["lapis_ore"];
    const {
        Movements,
        goals: {
            Goal,
            GoalBlock,
            GoalNear,
            GoalXZ,
            GoalNearXZ,
            GoalY,
            GoalGetToBlock,
            GoalLookAtBlock,
            GoalBreakBlock,
            GoalCompositeAny,
            GoalCompositeAll,
            GoalInvert,
            GoalFollow,
            GoalPlaceBlock,
        },
        pathfinder,
        Move,
        ComputedPath,
        PartiallyComputedPath,
        XZCoordinates,
        XYZCoordinates,
        SafeBlock,
        GoalPlaceBlockOptions,
    } = require("mineflayer-pathfinder");
    const { Vec3 } = require("vec3");

    // Set up pathfinder
    const movements = new Movements(bot, mcData);
    movements.blocksToAvoid.add(mcData.blocksByName["spruce_planks"].id)
    movements.blocksCantBreak.add(mcData.blocksByName["spruce_planks"].id)
    // movements.blocksCantBreak.add(mcData.blocksByName["oak_planks"].id)
    // movements.blocksToAvoid.add(mcData.blocksByName["oak_planks"].id)
    // movements.blocksCantBreak.add(mcData.blocksByName["birch_planks"].id)
    // movements.blocksToAvoid.add(mcData.blocksByName["birch_planks"].id)
    // movements.blocksCantBreak.add(mcData.blocksByName["jungle_planks"].id)
    // movements.blocksToAvoid.add(mcData.blocksByName["jungle_planks"].id)
    // movements.blocksCantBreak.add(mcData.blocksByName["spruce_planks"].id)
    // movements.blocksToAvoid.add(mcData.blocksByName["spruce_planks"].id)

    bot.pathfinder.setMovements(movements);

    bot.globalTickCounter = 0;
    bot.stuckTickCounter = 0;
    bot.stuckPosList = [];

    function onTick() {
        bot.globalTickCounter++;
        if (bot.pathfinder.isMoving()) {
            bot.stuckTickCounter++;
            if (bot.stuckTickCounter >= 100) {
                onStuck(1.5);
                bot.stuckTickCounter = 0;
            }
        }
    }

    bot.on("physicTick", onTick);

    // initialize fail count
    let _craftItemFailCount = 0;
    let _killMobFailCount = 0;
    let _mineBlockFailCount = 0;
    let _placeItemFailCount = 0;
    let _smeltItemFailCount = 0;

    // Retrieve array form post bod
    const code = req.body.code;
    const programs = req.body.programs;
    bot.cumulativeObs = [];
    await bot.waitForTicks(bot.waitTicks);
    const r = await evaluateCode(code, programs);
    process.off("uncaughtException", otherError);
    if (r !== "success") {
        bot.emit("error", handleError(r));
    }
    await returnItems();
    // wait for last message
    await bot.waitForTicks(bot.waitTicks);
    if (!response_sent) {
        response_sent = true;
        let curr_observation = bot.observe();
        const camera = new Camera(bot)
        camera.on('ready', async () => {
            const yaw = bot.entity.yaw; // Horizontal rotation (radians)
            const pitch = bot.entity.pitch; // Vertical rotation (radians)

            // Convert bot's rotation to camera coordinates
           const lookDirection = new THREE.Vector3(
                -Math.sin(yaw) * Math.cos(pitch), // Flip X
                   Math.sin(pitch),                // Y stays flipped (Minecraft uses positive downward)
                -Math.cos(yaw) * Math.cos(pitch) // Flip Z
            );
        await camera.takePicture(lookDirection, `${datetime}bot_pov`)

            const imageBuffer = fs.readFileSync(`./screenshots/${datetime}bot_pov.jpg`);
        const imageBase64 = imageBuffer.toString('base64');
        //fs.unlinkSync("./screenshots/bot_pov.jpg")


        let json_observation = JSON.parse(curr_observation);
            for (let i = 0; i < json_observation.length; i++) {
                if (json_observation[i][0] === "observe"){
                    json_observation[i][1]["image"] = imageBase64;
                    console.log("inserting image!")
                }
            }


        const new_observation = JSON.stringify(json_observation);

        res.json(new_observation);
  })
    }
    bot.removeListener("physicTick", onTick);

    async function evaluateCode(code, programs) {
        // Echo the code produced for players to see it. Don't echo when the bot code is already producing dialog or it will double echo
        try {
            await eval("(async () => {" + programs + "\n" + code + "})()");
            return "success";
        } catch (err) {
            return err;
        }
    }

    function onStuck(posThreshold) {
        const currentPos = bot.entity.position;
        bot.stuckPosList.push(currentPos);

        // Check if the list is full
        if (bot.stuckPosList.length === 5) {
            const oldestPos = bot.stuckPosList[0];
            const posDifference = currentPos.distanceTo(oldestPos);

            if (posDifference < posThreshold) {
                teleportBot(); // execute the function
            }

            // Remove the oldest time from the list
            bot.stuckPosList.shift();
        }
    }

    function teleportBot() {
        const blocks = bot.findBlocks({
            matching: (block) => {
                return block.type === 0;
            },
            maxDistance: 1,
            count: 27,
        });

        if (blocks) {
            // console.log(blocks.length);
            const randomIndex = Math.floor(Math.random() * blocks.length);
            const block = blocks[randomIndex];
            bot.chat(`/tp @s ${block.x} ${block.y} ${block.z}`);
        } else {
            bot.chat("/tp @s ~ ~1.25 ~");
        }
    }

    function returnItems() {
        bot.chat("/gamerule doTileDrops false");
        const crafting_table = bot.findBlock({
            matching: mcData.blocksByName.crafting_table.id,
            maxDistance: 128,
        });
        if (crafting_table) {
            bot.chat(
                `/setblock ${crafting_table.position.x} ${crafting_table.position.y} ${crafting_table.position.z} air destroy`
            );
            bot.chat("/give @s crafting_table");
        }
        const furnace = bot.findBlock({
            matching: mcData.blocksByName.furnace.id,
            maxDistance: 128,
        });
        if (furnace) {
            bot.chat(
                `/setblock ${furnace.position.x} ${furnace.position.y} ${furnace.position.z} air destroy`
            );
            bot.chat("/give @s furnace");
        }
        if (bot.inventoryUsed() >= 32) {
            // if chest is not in bot's inventory
            if (!bot.inventory.items().find((item) => item.name === "chest")) {
                bot.chat("/give @s chest");
            }
        }
        // if iron_pickaxe not in bot's inventory and bot.iron_pickaxe
        if (
            bot.iron_pickaxe &&
            !bot.inventory.items().find((item) => item.name === "iron_pickaxe")
        ) {
            bot.chat("/give @s iron_pickaxe");
        }
        bot.chat("/gamerule doTileDrops true");
    }

    function handleError(err) {
        let stack = err.stack;
        if (!stack) {
            return err;
        }
        console.log(stack);
        const final_line = stack.split("\n")[1];
        const regex = /<anonymous>:(\d+):\d+\)/;

        const programs_length = programs.split("\n").length;
        let match_line = null;
        for (const line of stack.split("\n")) {
            const match = regex.exec(line);
            if (match) {
                const line_num = parseInt(match[1]);
                if (line_num >= programs_length) {
                    match_line = line_num - programs_length;
                    break;
                }
            }
        }
        if (!match_line) {
            return err.message;
        }
        let f_line = final_line.match(
            /\((?<file>.*):(?<line>\d+):(?<pos>\d+)\)/
        );
        if (f_line && f_line.groups && fs.existsSync(f_line.groups.file)) {
            const { file, line, pos } = f_line.groups;
            const f = fs.readFileSync(file, "utf8").split("\n");
            // let filename = file.match(/(?<=node_modules\\)(.*)/)[1];
            let source = file + `:${line}\n${f[line - 1].trim()}\n `;

            const code_source =
                "at " +
                code.split("\n")[match_line - 1].trim() +
                " in your code";
            return source + err.message + "\n" + code_source;
        } else if (
            f_line &&
            f_line.groups &&
            f_line.groups.file.includes("<anonymous>")
        ) {
            const { file, line, pos } = f_line.groups;
            let source =
                "Your code" +
                `:${match_line}\n${code.split("\n")[match_line - 1].trim()}\n `;
            let code_source = "";
            if (line < programs_length) {
                source =
                    "In your program code: " +
                    programs.split("\n")[line - 1].trim() +
                    "\n";
                code_source = `at line ${match_line}:${code
                    .split("\n")
                    [match_line - 1].trim()} in your code`;
            }
            return source + err.message + "\n" + code_source;
        }
        return err.message;
    }
});

app.post("/stop", (req, res) => {
    bot.end();
    res.json({
        message: "Bot stopped",
    });
});

app.post("/pause", (req, res) => {
    if (!bot) {
        res.status(400).json({ error: "Bot not spawned" });
        return;
    }
    bot.chat("/pause");
    bot.waitForTicks(bot.waitTicks).then(() => {
        res.json({ message: "Success" });
    });
});

// Server listening to PORT 3000

const DEFAULT_PORT = 3000;
const PORT = process.argv[2] || DEFAULT_PORT;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

class Camera extends EventEmitter {
  constructor (bot) {
    super()
    this.bot = bot
    this.viewDistance = 4
    this.width = 512
    this.height = 512
    this.canvas = createCanvas(this.width, this.height)
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas })
    this.viewer = new Viewer(this.renderer)
    this._init().then(() => {
      this.emit('ready')
    })
  }

  async _init () {
    const botPos = this.bot.entity.position
    const center = new Vec3(botPos.x, botPos.y + 1.62, botPos.z)
    this.viewer.setVersion(this.bot.version)

    // Load world
    const worldView = new WorldView(this.bot.world, this.viewDistance, center)
    this.viewer.listen(worldView)

    this.viewer.camera.position.set(center.x, center.y, center.z)

    await worldView.init(center)
  }

  async takePicture (direction, name) {
    const cameraPos = new Vec3(this.viewer.camera.position.x, this.viewer.camera.position.y, this.viewer.camera.position.z)
    const point = cameraPos.add(direction)
    this.viewer.camera.lookAt(point.x, point.y, point.z)
    console.info('Waiting for world to load')
    await new Promise(resolve => setTimeout(resolve, 5000))
    this.renderer.render(this.viewer.scene, this.viewer.camera)

    const imageStream = this.canvas.createJPEGStream({
      bufsize: 4096,
      quality: 100,
      progressive: false
    })
    const buf = await getBufferFromStream(imageStream)
    let stats
    try {
      stats = await fsp.stat('./screenshots')
    } catch (e) {
      if (!stats?.isDirectory()) {
        await fsp.mkdir('./screenshots')
      }
    }
    await fsp.writeFile(`screenshots/${name}.jpg`, buf)
    console.log('saved', name)
  }
}
