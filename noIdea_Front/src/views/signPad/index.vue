<template>
  <div class="p-4 signPad">
    <el-button type="primary" :icon="Back" circle @click="goBack" />
    <div class="p-8">
      <canvas
        ref="signatureCanvas"
        width="600"
        height="400"
        style="border: 1px solid #000"
      ></canvas>
      <div class="controls mt-4">
        <el-button @click="goClear">清空</el-button>
        <el-button @click="goSave">保存签名</el-button>
      </div>
      <div v-if="signatureImg" style="margin-top: 20px">
        <h3>签名预览:</h3>
        <img
          :src="signatureImg"
          @click="previewSignature"
          alt="Signature Image"
          style="width: 200px; cursor: pointer"
        />
      </div>
      <div
        v-if="isPreview"
        class="block fixed z-10 left-0 top-0 w-full h-full bg-transparent"
        @click.self="isPreview = false"
      >
        <div class="modal-content bg-white p-20 w-4/5 max-w-screen-sm m-auto">
          <img
            :src="signatureImg"
            @click="previewSignature"
            alt="Signature Image"
            style="width: 600px; cursor: pointer"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Back } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";
import { onMounted, ref } from "vue";
import SignaturePad from "signature_pad";
const router = useRouter();
const signatureCanvas = ref();
const signatureImg = ref();
const signaturePad = ref();
const isPreview = ref(false);
onMounted(() => {
  const canvas = signatureCanvas.value;
  signaturePad.value = new SignaturePad(canvas);
});
const goBack = () => {
  router.go(-1);
};
//清除签名
const goClear = () => {
  signaturePad.value.clear();
};
//保存签名
const goSave = () => {
  if (!signaturePad.value.isEmpty()) {
    signatureImg.value = signaturePad.value.toDataURL();
  } else {
    alert("请先签名");
  }
};
const previewSignature = () => {
  isPreview.value = true;
};
</script>

<style scoped lang="less">
.signPad {
  canvas {
    border: 1px solid #000;
  }
  .modal-content {
    border: 1px solid #888;
  }

  .modal img {
    display: block;
    width: 100%;
  }
}
</style>