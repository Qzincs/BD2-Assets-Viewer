import { createRouter, createWebHistory } from 'vue-router'
import CharactersPage from '@/pages/CharactersPage.vue'
import CostumeDetailPage from '@/pages/CostumeDetailPage.vue'
import SpinePlayerDevPage from '@/pages/SpinePlayerDevPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/characters',
    },
    {
      path: '/characters',
      name: 'characters',
      component: CharactersPage,
    },
    {
      path: '/costumes/:costumeId',
      name: 'costume-detail',
      component: CostumeDetailPage,
      props: true,
    },
    {
      path: '/dev/spine-player',
      name: 'spine-player-dev',
      component: SpinePlayerDevPage,
    }
  ],
})

export default router
