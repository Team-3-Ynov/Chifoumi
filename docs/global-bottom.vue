<script setup lang="ts">
import { useSlideContext } from '@slidev/client'

const { $nav } = useSlideContext()
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
