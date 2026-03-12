<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
</script>

<template>
  <div class="shell">
    <header class="shell__header">
      <p class="shell__eyebrow">NIR3 Metrics Lab</p>
      <nav class="shell__nav">
        <router-link to="/" class="nav-link" :class="{ active: route.path === '/' }">Замер</router-link>
        <router-link to="/compare" class="nav-link" :class="{ active: route.path === '/compare' }">Сравнение</router-link>
      </nav>
    </header>
    <main class="shell__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell {
  max-width: 960px;
  margin: 0 auto;
  padding: 3rem 1.25rem 4rem;
}

.shell__header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.shell__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: #6366f1;
  font-size: 0.8rem;
  margin: 0 0 0.6rem;
}

.shell__title {
  margin: 0;
  font-size: 2.25rem;
  color: #0f172a;
}

.shell__nav {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 0.75rem;
}

.nav-link {
  padding: 0.6rem 1.5rem;
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: 500;
  font-size: 1rem;
  color: #475569;
  background: #f1f5f9;
  transition: all 0.2s;
}

.nav-link:hover { background: #e2e8f0; }

.nav-link.active {
  background: #4f46e5;
  color: white;
}

.shell__main {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
</style>

