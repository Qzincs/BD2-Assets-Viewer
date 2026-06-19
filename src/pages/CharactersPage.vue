<script setup lang="ts">
import CostumeCard from '@/components/cards/CostumeCard.vue'
import CostumeFilterBar from '@/components/filters/CostumeFilterBar.vue'
import { reactive, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

function openCostume(costumeId: string) {
  router.push({ name: 'costume-detail', params: { costumeId } })
}

type ActiveFilters = {
  element: 'fire' | 'water' | 'wind' | 'light' | 'dark' | null
  rarity: 3 | 4 | 5 | null
  attackType: 'physical' | 'magic' | null
  gender: 'male' | 'female' | null
}

const activeFilters = reactive<ActiveFilters>(readFiltersFromQuery())

/** Reads supported filter values from the current route query. */
function readFiltersFromQuery(): ActiveFilters {
  const element = readStringQuery('element')
  const rarity = Number(readStringQuery('rarity'))
  const attackType = readStringQuery('attackType')
  const gender = readStringQuery('gender')

  return {
    element: ['fire', 'water', 'wind', 'light', 'dark'].includes(element ?? '')
      ? (element as ActiveFilters['element'])
      : null,
    rarity: [3, 4, 5].includes(rarity) ? (rarity as ActiveFilters['rarity']) : null,
    attackType: ['physical', 'magic'].includes(attackType ?? '')
      ? (attackType as ActiveFilters['attackType'])
      : null,
    gender: ['male', 'female'].includes(gender ?? '') ? (gender as ActiveFilters['gender']) : null,
  }
}

function readStringQuery(key: string): string | undefined {
  const value = route.query[key]
  return typeof value === 'string' ? value : undefined
}

watch(activeFilters, () => {
  void router.replace({
    query: {
      ...route.query,
      element: activeFilters.element ?? undefined,
      rarity: activeFilters.rarity?.toString(),
      attackType: activeFilters.attackType ?? undefined,
      gender: activeFilters.gender ?? undefined,
    },
  })
})

watch(
  () => route.query,
  () => {
    Object.assign(activeFilters, readFiltersFromQuery())
  },
)

const groups = [
  {
    label: 'element',
    options: [
      { name: 'water', icon: '/assets/icons/water.png', value: 'water', activeBg: 'bg-[#3fbfff]' },
      { name: 'fire', icon: '/assets/icons/fire.png', value: 'fire', activeBg: 'bg-[#ff4242]' },
      { name: 'wind', icon: '/assets/icons/wind.png', value: 'wind', activeBg: 'bg-[#27c482]' },
      { name: 'light', icon: '/assets/icons/light.png', value: 'light', activeBg: 'bg-[#e0be4f]' },
      { name: 'dark', icon: '/assets/icons/dark.png', value: 'dark', activeBg: 'bg-[#c07fff]' },
    ],
  },
  {
    label: 'rarity',
    options: [
      { name: '5-star', icon: '/assets/icons/ui/icon_5_star.png', value: 5 },
      { name: '4-star', icon: '/assets/icons/ui/icon_4_star.png', value: 4 },
      { name: '3-star', icon: '/assets/icons/ui/icon_3_star.png', value: 3 },
    ],
  },
  {
    label: 'attackType',
    options: [
      { name: 'physical', icon: '/assets/icons/physical.png', value: 'physical' },
      { name: 'magic', icon: '/assets/icons/magic.png', value: 'magic' },
    ],
  },
  {
    label: 'gender',
    options: [
      { name: 'male', icon: '/assets/icons/ui/icon_male.png', value: 'male' },
      { name: 'female', icon: '/assets/icons/ui/icon_female.png', value: 'female' },
    ],
  },
]

const props = defineProps<{
  displayCostumes: {
    id: string
    characterName: string
    costumeName: string
    gender: 'male' | 'female' | 'none'
    element: 'fire' | 'water' | 'wind' | 'light' | 'dark' | 'none'
    rarity: 3 | 4 | 5 | 'none'
    attackType: 'physical' | 'magic' | 'none'
  }[]
}>()

const filteredCostumes = computed(() => {
  return props.displayCostumes.filter((c) => {
    return (
      (!activeFilters.element || c.element === activeFilters.element) &&
      (!activeFilters.rarity || c.rarity === activeFilters.rarity) &&
      (!activeFilters.attackType || c.attackType === activeFilters.attackType) &&
      (!activeFilters.gender || c.gender === activeFilters.gender)
    )
  })
})

const rarityOrder = [5, 4, 3] as const

const groupedCostumes = computed(() => {
  return rarityOrder
    .map((rarity) => ({
      rarity,
      costumes: filteredCostumes.value.filter((costume) => costume.rarity === rarity),
    }))
    .filter((group) => group.costumes.length > 0)
})
</script>

<template>
  <section class="flex-1 p-4">
    <CostumeFilterBar
      :groups="groups"
      :active-filters="activeFilters"
      @update:activeFilters="(val) => Object.assign(activeFilters, val)"
    />

    <template v-if="groupedCostumes.length === 0">
      <div class="text-center text-base-content/50 py-8">
        No costumes match the selected filters.
      </div>
    </template>

    <template v-else>
      <section v-for="group in groupedCostumes" :key="group.rarity" class="mb-6">
        <h2 class="text-lg font-bold mb-2">{{ group.rarity }} ★</h2>
        <div
          class="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(var(--grid-size),1fr))]"
          style="--grid-size: 120px"
        >
          <CostumeCard
            v-for="costume in group.costumes"
            :key="costume.id"
            :id="costume.id"
            :character-name="costume.characterName"
            :costume-name="costume.costumeName"
            :element="costume.element"
            @select="openCostume"
          />
        </div>
      </section>
    </template>
  </section>
</template>
