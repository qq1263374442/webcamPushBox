import Pushbox from './component/Pushbox'
import WebcamTransferLearning from './component/Webcam-transfer-learning';
import React from 'react'

function App() {
  return (
    <>
      {/* 推箱子游戏界面 */}
      <Pushbox></Pushbox>
      {/* 机器学习操作界面 */}
      <WebcamTransferLearning></WebcamTransferLearning>
    </>
  );
}

export default App;
