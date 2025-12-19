<template>
  <section class="card" v-bind="$attrs">
    <header v-if="$slots.header" class="card__header">
      <slot name="header" />
    </header>
    <div class="card__body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="card__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped>
.card {
  border-radius: 1.5rem;
  background: #fff;
  padding: 1.75rem;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.card__header {
  margin-bottom: 1rem;
}

.card__footer {
  margin-top: 1.25rem;
}
</style>

