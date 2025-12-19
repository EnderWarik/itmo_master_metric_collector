<template>
  <div class="shell">
    <header class="shell__header">
      <p class="shell__eyebrow">NIR3 Metrics Lab</p>
      <h1 class="shell__title">Замер метрик по URL</h1>
      <p class="shell__subtitle">
        Вставляй ссылку и запускай нужные измерения. Будем наращивать список
        доступных метрик шаг за шагом.
      </p>
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

.shell__subtitle {
  margin: 0.75rem auto 0;
  max-width: 640px;
  color: #475569;
}

.shell__main {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
</style>

