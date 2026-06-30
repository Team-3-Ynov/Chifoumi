<script setup lang="ts">
import { useSlideContext } from "@slidev/client";

// biome-ignore lint/correctness/useHookAtTopLevel: useSlideContext est un composable Vue (Slidev), pas un hook React
// biome-ignore lint/correctness/noUnusedVariables: $nav est consommé dans le <template>, non analysé par Biome
const { $nav } = useSlideContext();
</script>

<template>
  <!-- Numéro de page en bas à droite de chaque slide.
       Masqué sur la slide de couverture (page 1). -->
  <div
    v-if="$nav.currentPage > 1"
    class="abs-br m-3 text-xs opacity-40 select-none"
  >
    {{ $nav.currentPage }} / {{ $nav.total }}
  </div>
</template>

<style>
.slidev-layout,
.slidev-slide-content,
.slidev-slide-content > div {
  overflow-y: auto !important;
}
</style>
