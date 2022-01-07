import './index.css';
import Pushbox from '../Pushbox';
import PubSub from 'pubsub-js';
import * as tf from '@tensorflow/tfjs';
import * as tfd from '@tensorflow/tfjs-data';
import React,{useState,useEffect} from 'react'
import {
  ControllerDataset
} from './controller_dataset.js';

// 预测类型数量为4：上、下、左、右
const NUM_CLASSES = 4;
// 网络摄像头迭代器，从网络摄像头的图像生成张量.
let webcam;
// 我们将在其中存储激活的dataset对象。
const controllerDataset = new ControllerDataset(NUM_CLASSES);
let truncatedMobileNet;
let model;
const CONTROLS = ['up', 'down', 'left', 'right'];
let mouseDown = false;
const totals = [0, 0, 0, 0];
const thumbDisplayed = {};
let isPredicting = false;

export default function WebcamTransferLearning() {
  const [statusText,setstatusText]=useState('TRAIN MODEL')
  const [learningRate, setlearningRate] = useState(0.0001)
  const [batchSizeFraction, setbatchSizeFraction] = useState(0.4)
  const [epochs, setepochs] = useState(20)
  const [denseUnits, setdenseUnits] = useState(100)

// 将预测到的方向发给游戏界面
function predictClass(classId) {
  PubSub.publish('move',CONTROLS[classId]);
  document.body.setAttribute('data-active', CONTROLS[classId]);
}

// 加载mobilenet并返回返回内部激活的模型
// 我们将使用作为分类器模型的输入。
async function loadTruncatedMobileNet() {
  const mobilenet = await tf.loadLayersModel(
    'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json');
  const layer = mobilenet.getLayer('conv_pw_13_relu');
  return tf.model({
    inputs: mobilenet.inputs,
    outputs: layer.output
  });
}
// 按下UI按钮时，从网络摄像头读取一帧并关联
//它使用按钮给出的类标签进行编辑。上，下，左，右都是
// 分别标记0、1、2和3
const addExampleHandler=async label => {
  let img = await getImage();
  controllerDataset.addExample(truncatedMobileNet.predict(img), label);
  // Draw the preview thumbnail.
  if (thumbDisplayed[label] == null) {
    const thumbCanvas = document.getElementById(CONTROLS[label] + '-thumb');
    draw(img, thumbCanvas);
  }
  img.dispose();
}
function draw(image, canvas) {
  const [width, height] = [224, 224];
  const ctx = canvas.getContext('2d');
  const imageData = new ImageData(width, height);
  const data = image.dataSync();
  for (let i = 0; i < height * width; ++i) {
    const j = i * 4;
    imageData.data[j + 0] = (data[i * 3 + 0] + 1) * 127;
    imageData.data[j + 1] = (data[i * 3 + 1] + 1) * 127;
    imageData.data[j + 2] = (data[i * 3 + 2] + 1) * 127;
    imageData.data[j + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}
async function handler(label) {
  mouseDown = true;
  const className = CONTROLS[label];
  const total = document.getElementById(className + '-total');
  while (mouseDown) {
    addExampleHandler(label);
    document.body.setAttribute('data-active', CONTROLS[label]);
    total.innerText = ++totals[label];
    await tf.nextFrame();
  }
  document.body.removeAttribute('data-active');
}
/**
 * 设置和训练分类器
 */
 async function train() {
  if (controllerDataset.xs == null) {
    throw new Error('Add some examples before training!');
  }
  //创建两层完全连接的模型。通过创建单独的模型，
  //我们不向mobilenet模型添加层，而是“冻结”权重
  //mobilenet模型的重量，并且仅来自新模型的列车重量.
  model = tf.sequential({
    layers: [
      tf.layers.flatten({
        inputShape: truncatedMobileNet.outputs[0].shape.slice(1)
      }),
      tf.layers.dense({
        units: denseUnits,
        activation: 'relu',
        kernelInitializer: 'varianceScaling',
        useBias: true
      }),
      tf.layers.dense({
        units: NUM_CLASSES,
        kernelInitializer: 'varianceScaling',
        useBias: false,
        activation: 'softmax'
      })
    ]
  });
  // 创建驱动模型培训的优化器.
  const optimizer = tf.train.adam(learningRate);
  model.compile({
    optimizer: optimizer,
    loss: 'categoricalCrossentropy'
  });
  const batchSize =
    Math.floor(controllerDataset.xs.shape[0] * batchSizeFraction);
  if (!(batchSize > 0)) {
    throw new Error(
      `Batch size is 0 or NaN. Please choose a non-zero fraction.`);
  }
  model.fit(controllerDataset.xs, controllerDataset.ys, {
    batchSize,
    epochs: epochs,
    callbacks: {
      onBatchEnd: async (batch, logs) => {
        setstatusText('Loss: ' + logs.loss.toFixed(5))
      }
    }
  });
}

async function predict() {
  setInterval(async () => {
    if (isPredicting) {
      // 从网络摄像头捕获帧。
      const img = await getImage();
      //通过mobilenet进行预测，获取
      //mobilenet模型，即输入图像的“嵌入”。
      const embeddings = truncatedMobileNet.predict(img);
      // 使用新训练的模型进行预测
      const predictions = model.predict(embeddings);
      //以最大概率返回索引。这个数字相当于
      //对于模型认为最有可能输入的类。
      const predictedClass = predictions.as1D().argMax();
      const classId = (await predictedClass.data())[0];
      img.dispose();
      predictClass(classId);
      await tf.nextFrame();
    }
  }, 1000);
}
async function getImage() {
  const img = await webcam.capture();
  const processedImg =
    tf.tidy(() => img.expandDims(0).toFloat().div(127).sub(1));
  img.dispose();
  return processedImg;
}
const startTrain=async ()=>{
  setstatusText('Training...')
  await tf.nextFrame();
  await tf.nextFrame();
  isPredicting = false;
  train();
}
const startPredict=async ()=>{
  isPredicting = true;
  predict();
}
async function init() {
  try {
    webcam = await tfd.webcam(document.getElementById('webcam'));
  } catch (e) {
    console.log(e);
    document.getElementById('no-webcam').style.display = 'block';
  }
  truncatedMobileNet = await loadTruncatedMobileNet();
  
  document.getElementById('controller').style.display = '';

  // 预热模型。这会将权重上传到GPU并编译WebGL
  // 因此，我们第一次从网络摄像头收集数据时，速度会很快
  const screenShot = await webcam.capture();
  truncatedMobileNet.predict(screenShot.expandDims(0));
  screenShot.dispose();
}
useEffect(() => {
  init()
}, [])// eslint-disable-line

  return (
    <>
      <div id="no-webcam">
        No webcam found. <br />
        To use this demo, use a device with a webcam.
      </div>

      <div className="controller-panels" id="controller" >
            {/* 机器学习左边部分 */}
            <div className="panel training-panel">

                  <div className="panel-row big-buttons">
                    <button id="train" onClick={startTrain} >
                      <img width={66} height={66} src={"/images/button.svg"} alt=''/>
                      <span id="train-status">{statusText}</span>
                    </button>
                    <button id="predict" onClick={startPredict} >
                      <img width={66} height={66} src={"/images/button.svg"} alt=''/>
                      <span>PLAY</span>
                    </button>
                  </div>

                  <div className="panel-row params-webcam-row">

                    <div className="hyper-params">

                      <div className="dropdown">
                        <label>Learning rate</label>
                        <div className="select">
                          <select id="learningRate" defaultValue={0.0001}
                          onChange={(value)=>{setlearningRate(value)}} >
                            <option value="0.00001">0.00001</option>
                            <option value="0.0001">0.0001</option>
                            <option value="0.01">0.001</option>
                            <option value="0.03">0.003</option>
                          </select>
                        </div>
                      </div>

                      <div className="dropdown">
                        <label>Batch size</label>
                        <div className="select">
                          <select id="batchSizeFraction" defaultValue={0.4} 
                          onChange={(value)=>{setbatchSizeFraction(value)}} >
                            <option value="0.05">0.05</option>
                            <option value="0.1">0.1</option>
                            <option value="0.4">0.4</option>
                            <option value="1">1</option>
                          </select>
                        </div>
                      </div>

                      <div className="dropdown">
                        <label>Epochs</label>
                        <div className="select">
                          <select id="epochs" defaultValue={20} 
                          onChange={(value)=>{setepochs(value)}} >
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="40">40</option>
                          </select>
                        </div>
                      </div>

                      <div className="dropdown">
                        <label>Hidden units</label>
                        <div className="select">
                          <select id="dense-units" defaultValue={100} 
                          onChange={(value)=>{setdenseUnits(value)}} >
                            <option value="10">10</option>
                            <option value="100">100</option>
                            <option value="200">200</option>
                          </select>
                        </div>
                      </div>

                    </div>

                    <div className="webcam-box-outer">
                      <div className="webcam-box-inner">
                        <video autoPlay playsInline muted id="webcam" 
                         width={224} height={224} ></video>
                      </div>
                    </div>

                  </div>

            </div>
            {/* 机器学习右边部分 */}
            <div className="panel joystick-panel">
                <div className="panel-row panel-row-top">
                      <div className="panel-cell panel-cell-left panel-cell-fill">
                        <p className="help-text">
                          Click to add the <br />
                          current camera <br />
                          view as an example <br />
                          for that control
                        </p>
                      </div>

                      <div className="panel-cell panel-cell-center">
                        <div className="thumb-box">
                          <div className="thumb-box-outer">
                            <div className="thumb-box-inner">
                              <canvas className="thumb" width={224} height={224} id="up-thumb"></canvas>
                            </div>
                            <button className="record-button" id="up" onMouseDown={()=>handler(0)} onMouseUp={()=>mouseDown = false} ><span>Add Sample</span></button>
                          </div>
                          <p>
                            <span id="up-total">0</span> examples
                          </p>
                        </div>
                      </div>

                      <div className="panel-cell panel-cell-right panel-cell-fill">
                      </div>
                </div>

                <div className="panel-row panel-row-middle">
                      <div className="panel-cell panel-cell-left">
                        <div className="thumb-box">
                          <div className="thumb-box-outer">
                            <div className="thumb-box-inner">
                              <canvas className="thumb" width={224} height={224} id="left-thumb"></canvas>
                            </div>
                            <button className="record-button" id="left" onMouseDown={()=>handler(2)} onMouseUp={()=>mouseDown = false} ><span>Add Sample</span></button>
                          </div>
                          <p>
                            <span id="left-total">0</span> examples
                          </p>
                        </div>
                      </div>
                      <div className="panel-cell panel-cell-center panel-cell-fill">
                        <img width={129} height={108} src={"/images/joystick.png"} alt=''/>
                      </div>
                      <div className="panel-cell panel-cell-right">
                        <div className="thumb-box">
                          <div className="thumb-box-outer">
                            <div className="thumb-box-inner">
                              <canvas className="thumb" width={224} height={224} id="right-thumb"></canvas>
                            </div>
                            <button className="record-button" id="right" onMouseDown={()=>handler(3)} onMouseUp={()=>mouseDown = false} ><span>Add Sample</span></button>
                          </div>
                          <p>
                            <span id="right-total">0</span> examples
                          </p>
                        </div>
                      </div>
                </div>

                <div className="panel-row panel-row-bottom">
                      <div className="panel-cell panel-cell-left panel-cell-fill">
                      </div>
                      <div className="panel-cell panel-cell-center">
                        <div className="thumb-box">
                          <div className="thumb-box-outer">
                            <div className="thumb-box-inner">
                              <canvas className="thumb" width={224} height={224} id="down-thumb"></canvas>
                            </div>
                            <button className="record-button" id="down" onMouseDown={()=>handler(1)} onMouseUp={()=>mouseDown = false} ><span>Add Sample</span></button>
                          </div>
                          <p>
                            <span id="down-total">0</span> examples
                          </p>
                        </div>
                      </div>

                      <div className="panel-cell panel-cell-right panel-cell-fill">
                      </div>

                </div>
            </div>
      </div>

    </>
  );
}