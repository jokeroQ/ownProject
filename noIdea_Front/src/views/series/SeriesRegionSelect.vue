<template>
  <el-select
    :model-value="modelValue"
    :aria-label="label"
    placeholder="全部地区"
    @update:model-value="emit('update:modelValue', $event)"
    @change="emit('change')"
  >
    <el-option value="" label="全部地区" />
    <el-option-group label="国内">
      <el-option value="国内" label="国内">国内（全部）</el-option>
    </el-option-group>
    <el-option-group label="国外">
      <el-option value="国外" label="国外">国外（全部）</el-option>
      <el-option value="欧美" label="欧美" />
      <el-option value="日韩" label="日韩" />
    </el-option-group>
    <el-option-group label="具体国家 / 地区">
      <el-option
        v-for="region in [
          '中国大陆',
          '中国香港',
          '中国台湾',
          '日本',
          '韩国',
          '美国',
          '英国',
          '法国',
          '泰国',
        ]"
        :key="region"
        :value="region"
        :label="region"
      />
    </el-option-group>
  </el-select>
</template>
<script setup lang="ts">
import { ElOption, ElOptionGroup, ElSelect } from 'element-plus';
defineProps<{ modelValue: string; label: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; change: [] }>();
</script>
