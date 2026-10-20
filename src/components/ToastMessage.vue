<script setup>
defineProps({ message: String, visible: Boolean })
</script>
<template>
<div class="toast" :class="{ show: visible }" role="status">{{ message }}</div>
</template>
