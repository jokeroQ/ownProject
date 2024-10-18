<template>
  <div class="chat">
    <div class="left">
      <div class="top">
        <span>元</span>
      </div>
      <div class="mesList">
        <div
          class="item"
          v-for="i in state.mesList"
          :key="i.id"
          :class="activeId == i.id ? 'active' : ''"
          @click="switchMsg(i.id)"
        >
          <div class="header"></div>
          <div>
            <div>{{ i.name }}</div>
            <div>{{ i.content }}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="right">
      <div class="content" ref="scrollRef">
        <div
          class="msg-item"
          v-for="i in state.msgList"
          :key="i.time"
          :class="i.inputer ? 'rgt' : 'lft'"
        >
          <div class="header"></div>
          <div class="msg" :class="i.inputer ? 'rgt' : 'lft'">{{ i.msg }}</div>
        </div>
      </div>
      <div class="bottom">
        <textarea
          class="messageInput"
          placeholder="输入消息..."
          v-model="currentIput"
          @keyup.enter="sendMsg"
        ></textarea>
        <div class="btn">
          <el-button type="success" @click="sendMsg">Enter</el-button>
        </div>
      </div>
    </div>
  </div>
</template>
  <script lang='ts' setup>
export interface Type {
  name: string;
  time: number;
  inputer: boolean;
  msg: string | null;
}
import { stat } from "fs";
import { ref, reactive } from "vue";
const state = reactive({
  mesList: [
    {
      name: "小王",
      content: "最近怎么样",
      id: "1",
      img: "12",
    },
    {
      name: "小刘",
      content: "hi",
      id: "2",
      img: "12",
    },
  ],
  msgList: <Array<Type>>[
    {
      name: "小王",
      time: 12,
      inputer: false,
      msg: "最近咋样",
    },
    {
      name: "小刘",
      time: 2,
      inputer: false,
      msg: "你还好吗",
    },
  ],
});
const activeId = ref<string>("1");
const currentIput = ref<string | null>(null);
const scrollRef = ref<HTMLDivElement | null>(null);
//发送信息
const sendMsg = () => {
  if (currentIput.value?.trim()) {
    const time = new Date();
    state.msgList.push({
      time: time.getTime(),
      name: "元",
      inputer: true,
      msg: currentIput.value,
    });
    currentIput.value = "";
    const container = scrollRef.value;
    if (container) {
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }
};
//切换成员发消息
const switchMsg = (id: string) => {
  activeId.value = id;
  state.msgList = [];
};
</script>
  <style lang="less" scoped>
.chat {
  display: flex;
  height: 100vh;
  width: 100vw;
  .header {
    width: 50px;
    height: 50px;
    border-radius: 4px;
    display: inline-block;
    background-color: orange;
    margin-right: 12px;
  }
  .left {
    width: 300px;
    background-color: antiquewhite;
    .top {
      text-align: center;
      margin-top: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f6f6f6;
      span {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: inline-block;
        background-color: burlywood;
        text-align: center;
        line-height: 50px;
      }
    }
    .mesList {
      .item {
        display: flex;
        padding: 12px;
        border-bottom: 1px solid #f6f6f6;
        &:hover {
          background-color: skyblue;
          cursor: pointer;
        }
        &.active {
          background-color: skyblue;
        }
      }
    }
  }
  .right {
    flex: 1;
    display: flex;
    flex-direction: column;
    .content {
      flex: 1;
      padding: 12px;
      overflow: scroll;
      &::-webkit-scrollbar {
        display: none; /* 隐藏滚动条 */
      }
      .msg-item {
        display: flex;
        align-items: center;
        margin-top: 12px;
        &.lft {
          flex-direction: row;
        }
        &.rgt {
          flex-direction: row-reverse;
        }
        .msg {
          padding: 4px 8px;
          background-color: greenyellow;
          border-radius: 6px;
          position: relative;
          max-width: 60%;
          &.lft {
            margin-left: 8px;
          }
          &.lft::after {
            content: "";
            position: absolute;
            left: -16px;
            top: 8px;
            width: 0;
            height: 0;
            border: 8px solid transparent;
            border-right-color: greenyellow;
          }
          &.rgt::after {
            content: "";
            position: absolute;
            right: -16px;
            top: 8px;
            width: 0;
            height: 0;
            border: 8px solid transparent;
            border-left-color: greenyellow;
          }
          &.rgt {
            margin-right: 20px;
          }
        }
      }
    }
    .bottom {
      height: 200px;
      // background-color: aqua;
      display: flex;
      flex-direction: column;
      border-top: 1px solid #f6f6f6;
      .btn {
        text-align: right;
        padding-right: 12px;
        padding-bottom: 12px;
      }
      .messageInput {
        flex: 1;
        border: none;
        border-radius: 5px;
        padding: 10px;
        font-size: 16px;
        resize: none; /* 禁用调整大小 */
        height: 40px;
        transition: border-color 0.2s;
        outline: none;
      }
    }
  }
}
</style>