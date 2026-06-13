<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import { characters } from '@/data/characters'
import { costumes } from '@/data/costumes'
import { characterI18n } from '@/data/characterI18n'
import { costumeI18n } from '@/data/costumeI18n'
import type { Locale } from '@/types/locale'
import { getCharacterIdFromCostumeId } from '@/utils/getCharacterIdFromCostumeId'

const collapsed = ref(true)
const selectedMenu = ref('Characters')
const currentLocale = ref<Locale>('zh-CN')
const router = useRouter()

const menuItems = [
  { name: 'Characters', icon: '/assets/icons/ui/icon_characters.png' },
  { name: 'Special Illust', icon: '/assets/icons/ui/icon_scene.png' },
  { name: 'Music', icon: '/assets/icons/ui/icon_music.png' },
]

const characterMap = computed(() => {
  return new Map(characters.map(c => [c.id, c]))
})

const displayCostumes = computed(() => {
  const locale = currentLocale.value

  return costumes.map((costume) => {
    const characterId = getCharacterIdFromCostumeId(costume.id)
    const character = characterMap.value.get(characterId)

    return {
      ...costume,
      characterId,
      characterName: characterI18n[locale]?.[characterId] ?? characterId,
      costumeName: costumeI18n[locale]?.[costume.id] ?? costume.id,
      gender: character?.gender ?? 'none',
      element: character?.element ?? 'none',
      rarity: character?.rarity ?? 'none',
      attackType: character?.attackType ?? 'none',
    }
  })
})

function toggleSidebar() {
  collapsed.value = !collapsed.value
}

function selectMenu(name: string) {
  selectedMenu.value = name

  if (name === 'Characters') {
    router.push({ name: 'characters' })
  }
}
</script>

<template>
  <AppHeader @toggle-sidebar="toggleSidebar" />

  <main class="grow px-4 flex flex-col mt-16 min-h-[calc(100dvh-64px)]"
    :style="{ marginLeft: collapsed ? '4rem' : '11rem', transition: 'margin-left 0.3s ease-in-out' }">
    <AppSidebar :collapsed="collapsed" :menu-items="menuItems" :selected-menu="selectedMenu"
      @select-menu="selectMenu" />

    <RouterView v-slot="{ Component }">
      <component :is="Component" :display-costumes="displayCostumes" />
    </RouterView>
  </main>
</template>
