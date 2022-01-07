import React, { useEffect } from 'react'
import PubSub from 'pubsub-js';
import {levels} from './mapdata100' 
import './index.css'

// 0--普通地板 1--墙 2--目标点 3--箱子 4--玩家

export default function Pushbox() {
    let can1 ;
    let context1;
    let nowLevel = [];
    let tempTimer=null
    let blockPic=new Image()
    blockPic.src="/images/block.gif";
    let boxPic=new Image()
    boxPic.src="/images/box.png";
    let wallPic=new Image()
    wallPic.src="/images/wall.png";
    let yelloballPic=new Image()
    yelloballPic.src="/images/yelloball.png";
    let rolePic=new Image()
    rolePic.src="/images/role.png";
    
    let boxs = [];
    let balls = [];
    let me=null;
    let time = 0;
    let level = 0;
    let changeX = 0;
    let changeY = 0;
    let complete = 0;
    // 画出箱子、人物角色（会动）
    function drawLine(x) {
        let i = 0;
        // 画箱子
        while (boxs[i]) {
            if (boxs[i].realY == x) {
                context1.beginPath();
                context1.drawImage(boxPic, boxs[i].x, boxs[i].y - 10);
            }
            i++;
        }
        // 画人物角色
        i = 0;
        if (me.realY == x) {
            context1.beginPath();
            context1.drawImage(rolePic, me.walkX, me.walkY, 100, 100, me.x - 18, me.y - 65, 70, 90);
        }
    }
    // 调用16次drawLine
    function drawItem() {
        for (let i = 0; i < 16; i++) {
            drawLine(i);
        }
    }
    // 画出全部地板、目标点、墙（静止）
    function drawMap() {
        context1.beginPath();
        for (let i = 0; i < levels[level].length; i++) {
            for (let j = 0; j < levels[level][i].length; j++) {
                //地板
                context1.drawImage(blockPic, 35 * i, 35 * j, 35, 35);
                let curItem=levels[level][i][j]
                //目标点
                if(curItem===2){
                    context1.drawImage(yelloballPic, 35*i, 35*j);
                }
                //墙
                else if(curItem===1){
                    context1.drawImage(wallPic, 35*i, 35*j-10);
                }
            }
        }
    }
    // 复制一份地图信息，根据地图信息将要画的图片放入对应的数组
    function setItem() {
        for (let i = 0; i < levels[level].length; i++) {
            nowLevel[i] = [];
            for (let j = 0; j < levels[level][i].length; j++) {
                nowLevel[i][j] = levels[level][i][j]
            }
        }
        boxs = [];
        balls = []
        me = null;
        time = 0;
        changeX = 0;
        changeY = 0;
        complete = 0;
        // 根据地图信息将要画的图片放入对应的数组
        for (let i = 0; i < nowLevel.length; i++) {
            for (let j = 0; j < nowLevel[i].length; j++) {
                // 箱子
                if (nowLevel[i][j] == 3) {
                    let aBox = {
                        x: i * 35,
                        y: j * 35,
                        realX: i,
                        realY: j
                    };
                    boxs.push(aBox);
                }
                // 目标点
                if (nowLevel[i][j] == 2) {
                    let ball = {
                        x: i * 35,
                        y: j * 35,
                    };
                    balls.push(ball);
                }
                // 玩家角色
                if (nowLevel[i][j] == 4) {
                    me = {
                        x: i * 35,
                        y: j * 35,
                        walkX: 0,
                        walkY: 0,
                        realX: i,
                        realY: j
                    };
                }
            }
        }
        //防止图片未加载好（收到预测的图片后清除）
        tempTimer=setInterval(() => {
            drawAll()
        }, 30);
    }
    // 0--普通地板 1--墙 2--目标点 3--箱子 4--玩家 
    function key() {
        // 若按下了方向键
        if (changeX != 0 || changeY != 0) {
            //下一步为目标点或普通地板
            if (nowLevel[me.realX + changeX][me.realY + changeY] == 0 || nowLevel[me.realX + changeX][me.realY + changeY] == 2) {
                me.y += 5 * changeY;
                me.x += 5 * changeX;
            }
            /*下一步为箱子*/
            else if (nowLevel[me.realX + changeX][me.realY + changeY] == 3) {
                // 箱子能移动
                if (nowLevel[me.realX + 2 * changeX][me.realY + 2 * changeY] == 0 || nowLevel[me.realX + 2 * changeX][me.realY + 2 * changeY] == 2) {
                    me.y += 5 * changeY;
                    me.x += 5 * changeX;
                    for (let i = 0; i < boxs.length; i++) {
                        if (boxs[i].realX == me.realX + changeX && boxs[i].realY == me.realY + changeY) {
                            boxs[i].y += 5 * changeY;
                            boxs[i].x += 5 * changeX;
                            break
                        }
                    }
                }
            }
            time += 5;
            if (time >= 7) {
                me.walkX = 100;
            }
            if (time >= 14) {
                me.walkX = 200;
            }
            if (time >= 21) {
                me.walkX = 300;
            }
            if (time >= 35) {
                me.walkX = 0;
                time = 0;
                // 不为墙或箱子,能走到下一步
                if (nowLevel[me.realX + changeX][me.realY + changeY] != 1 && nowLevel[me.realX + changeX][me.realY + changeY] != 3) {
                    nowLevel[me.realX][me.realY] = 0;
                    nowLevel[me.realX + changeX][me.realY + changeY] = 4;
                    me.realY += changeY;
                    me.realX += changeX;
                }
                //下一步为箱子
                else if (nowLevel[me.realX + changeX][me.realY + changeY] == 3) {
                    // 判断箱子能否移动
                    if (nowLevel[me.realX + 2 * changeX][me.realY + 2 * changeY] == 0 || nowLevel[me.realX + 2 * changeX][me.realY + 2 * changeY] == 2) {
                        for (let i = 0; i < boxs.length; i++) {
                            if (boxs[i].realX == me.realX + changeX && boxs[i].realY == me.realY + changeY) {
                                boxs[i].realY += changeY;
                                boxs[i].realX += changeX;
                                break
                            }
                        }
                        nowLevel[me.realX + 2 * changeX][me.realY + 2 * changeY] = 3;
                        nowLevel[me.realX + changeX][me.realY + changeY] = 4;
                        nowLevel[me.realX][me.realY] = 0;
                        me.realY += changeY;
                        me.realX += changeX;

                    }
                }
                changeX = 0;
                changeY = 0;
            }
        }
    }
    // 判断是否通关，context1画出当前关卡文字
    function win() {
        complete = 0;
        for (let i = 0; i < balls.length; i++) {
            for (let j = 0; j < boxs.length; j++) {
                if (balls[i].x == boxs[j].realX * 35 && balls[i].y == boxs[j].realY * 35) {
                    complete++;
                }
            }
        }
        if (complete == balls.length) {
            level++;
            setItem()
        }
        context1.fillStyle = "rgba(255,255,255,1)";
        context1.font = "bold 30px cursive";
        let level2 = level + 1
        context1.fillText("Level:" + level2, 10, 20)
    }
    function jumpTo(){
        let jump=document.getElementById("guaQia")
        if (jump.value > 0 && jump.value < 100) {
            level = jump.value;
            level--;
            setItem()
        } else {
            jump.value = "num:from 0 to 99"
        }
    }
    function restart(){
        setItem()
    }
    function drawAll(){
        context1.clearRect(0, 0, can1.width, can1.height)
        drawMap();
        drawItem();
        key();
        win()
    }
    function init(){
        can1 = document.getElementById("canvas1");
        context1=can1.getContext("2d")
        setItem();
    }
    function move(dir){
        if (time == 0) {
            switch (dir) {
                case 'left':
                    changeX = -1;
                    me.walkY = 100
                    console.log('左')
                    break;
                case 'up':
                    changeY = -1;
                    me.walkY = 300
                    console.log('上')
                    break;
                case 'right':
                    changeX = 1;
                    me.walkY = 200
                    console.log('右')
                    break;
                case 'down':
                    changeY = 1;
                    me.walkY = 0
                    console.log('下')
                    break;
            }
            //清除定时器
            if(tempTimer){
                clearInterval(tempTimer)
            }
            //30毫秒运行一次,运行7次
            let num=0
            let timer=setInterval(() => {
                num++
                if(num>7){
                    clearInterval(timer)
                }
                drawAll()
            }, 30);
        }
    }
    //订阅消息：收到消息后进行移动
    useEffect(() => {
        const token = PubSub.subscribe('move',(msg,item)=>{
           move(item)
        })
        return () => {
            PubSub.unsubscribe(token);
        }
    }, [])

    useEffect(() => {
        init()
    }, [])// eslint-disable-line
    return (
        <div id="game">
            <canvas id="canvas1" width="560px" height="560px"></canvas>
            {/* context.drawImage画图 ：引入空图片或者使用setinterval才能显示 */}
            <img src="/images/wall.png" alt="" />
            <img src="/images/box.png" alt="" />
            <img src="/images/yelloball.png" alt="" />
            <img src="/images/block.gif" alt="" />
            <img src="/images/role.png" alt="" />
            <div id="menu">
                <div id="text">菜单</div>
                <input id="guaQia"></input>
                <div id="button">
                    <button id="jump" onClick={jumpTo}>跳关</button>
                    <button id="replay" onClick={restart}>重玩本关</button>
                </div>
            </div>
        </div>
    )
}