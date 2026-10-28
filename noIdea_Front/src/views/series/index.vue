<template>
  <div class="series-page">
    <div class="series-content">
      <header class="series-header">
        <PageBackButton @click="goBack" />
        <div class="series-heading">
          <h1>最新剧集检索</h1>
          <p>找一部好剧，留一点时间给喜欢的故事。</p>
        </div>
        <el-tooltip content="重新加载" :trigger-keys="[]" :show-after="250"
          ><el-button
            class="app-icon-button series-icon"
            :icon="Refresh"
            aria-label="重新加载剧集"
            :disabled="displayLoading"
            @click="reloadCurrent"
        /></el-tooltip>
      </header>

      <nav class="page-tabs" aria-label="发现与个人片单">
        <button
          type="button"
          :class="{ active: view === 'discover' }"
          :aria-pressed="view === 'discover'"
          @click="chooseView('discover')"
        >
          发现剧集
        </button>
        <button
          type="button"
          :class="{ active: view === 'library' }"
          :aria-pressed="view === 'library'"
          @click="chooseView('library')"
        >
          我的片单 <span>{{ library.counts.value.all }}</span>
        </button>
      </nav>
      <div v-if="library.statusError.value" class="series-error library-warning" role="alert">
        <el-icon><Warning /></el-icon>
        <p>{{ library.statusError.value }}</p>
        <el-button text :loading="library.statusLoading.value" @click="library.refreshStatus"
          >重试片单</el-button
        >
      </div>
      <section v-if="view === 'library'" class="library-controls" aria-label="个人片单筛选">
        <nav class="library-tabs" aria-label="片单分类">
          <button
            v-for="list in libraryLists"
            :key="list.value"
            type="button"
            :class="{ active: libraryList === list.value }"
            :aria-pressed="libraryList === list.value"
            @click="chooseList(list.value)"
          >
            {{ list.label }} <span>{{ library.counts.value[list.value] }}</span>
          </button>
        </nav>
        <div class="library-region">
          <label>地区</label
          ><SeriesRegionSelect
            v-model="libraryRegion"
            label="片单地区"
            @change="chooseLibraryRegion"
          />
        </div>
        <form class="library-search" @submit.prevent="searchLibrary">
          <el-input
            v-model="libraryKeyword"
            :prefix-icon="Search"
            placeholder="在我的片单中搜索"
            aria-label="片单关键词"
            clearable
            maxlength="80"
            @clear="searchLibrary"
          />
          <el-button
            class="app-icon-button series-icon"
            :icon="Search"
            native-type="submit"
            aria-label="搜索片单"
            :disabled="libraryLoading"
          />
        </form>
      </section>
      <section v-if="view === 'discover'" class="discovery-controls" aria-label="剧集检索筛选">
        <form class="series-search" @submit.prevent="apply">
          <el-input
            v-model="filters.keyword"
            :prefix-icon="Search"
            placeholder="搜索剧名，海外作品也可输入原文名称"
            aria-label="剧集关键词"
            clearable
            maxlength="80"
            @clear="apply"
          />
          <el-button type="primary" :icon="Search" native-type="submit" :loading="loading"
            >检索</el-button
          >
        </form>
        <nav class="kind-tabs" aria-label="内容分类">
          <button
            v-for="kind in kinds"
            :key="kind.value"
            type="button"
            :class="{ active: filters.kind === kind.value }"
            :aria-pressed="filters.kind === kind.value"
            @click="chooseKind(kind.value)"
          >
            {{ kind.label }}
          </button>
        </nav>
        <div class="filter-grid">
          <div class="filter-field">
            <label>来源</label
            ><el-select v-model="filters.source" aria-label="数据来源" @change="chooseSource"
              ><el-option
                v-for="option in sources"
                :key="option.value"
                :value="option.value"
                :label="option.label"
            /></el-select>
          </div>
          <div class="filter-field">
            <label>题材</label
            ><el-select
              v-model="filters.genre"
              aria-label="剧集题材"
              placeholder="不限题材"
              @change="apply"
              ><el-option value="" label="不限题材" /><el-option
                v-for="genre in genres"
                :key="genre"
                :value="genre"
                :label="genre"
            /></el-select>
          </div>
          <div class="filter-field">
            <label>地区</label
            ><SeriesRegionSelect v-model="filters.region" label="制作地区" @change="apply" />
          </div>
          <div class="filter-field">
            <label>年份</label
            ><el-select v-model="filters.year" aria-label="首播年份" @change="apply"
              ><el-option value="recent" label="近两年" /><el-option
                value="all"
                label="不限年份" /><el-option
                v-for="year in years"
                :key="year"
                :value="String(year)"
                :label="String(year)"
            /></el-select>
          </div>
          <div class="filter-field">
            <label>评分</label
            ><el-select v-model="filters.minScore" aria-label="最低评分" @change="apply"
              ><el-option value="0" label="全部评分" /><el-option
                v-for="value in [6, 7, 8, 9]"
                :key="value"
                :value="String(value)"
                :label="`${value} 分及以上`"
            /></el-select>
          </div>
          <el-button class="reset-filters" text @click="reset">重置筛选</el-button>
        </div>
      </section>

      <SeriesCatalogInfo v-if="view === 'discover'" />
      <section
        v-if="
          view === 'discover' &&
          (filters.kind === 'ai' || filters.kind === 'short' || filters.source === 'bilibili')
        "
        class="platform-search"
        aria-label="拓展平台搜索"
      >
        <div>
          <strong>{{ filters.kind === 'ai' ? '发现更多 AI 故事' : '拓展平台检索' }}</strong>
          <p>未被评分库收录的内容可前往平台搜索；平台入口不会计入下方检索结果。</p>
        </div>
        <div class="platform-links">
          <a :href="bilibiliSearch" target="_blank" rel="noopener noreferrer"
            >B站检索 <el-icon><TopRight /></el-icon></a
          ><a :href="douyinSearch" target="_blank" rel="noopener noreferrer"
            >抖音 / 红果相关 <el-icon><TopRight /></el-icon
          ></a>
        </div>
      </section>

      <div v-if="view === 'discover'" class="results-toolbar">
        <div class="result-count" role="status">
          {{ loading ? '正在检索…' : `本页 ${result?.items.length || 0} 部作品`
          }}<span v-if="updatedText && !loading">更新于 {{ updatedText }}</span>
        </div>
        <div class="sort-options" aria-label="结果排序">
          <button
            v-for="sort in sorts"
            :key="sort.value"
            type="button"
            :aria-pressed="filters.sort === sort.value"
            :class="{ active: filters.sort === sort.value }"
            @click="chooseSort(sort.value)"
          >
            {{ sort.label }}
          </button>
        </div>
      </div>

      <div v-if="view === 'library'" class="library-summary" role="status">
        {{ libraryLoading ? '正在读取片单…' : `共 ${libraryResult?.total || 0} 部作品`
        }}<span>仅自己可见 · 按最近更新排列</span>
      </div>
      <div v-if="view === 'library' && libraryError" class="series-error" role="alert">
        <el-icon><Warning /></el-icon>
        <p>{{ libraryError }}</p>
        <el-button text @click="loadLibrary">重试</el-button>
      </div>
      <div
        v-if="view === 'discover' && (error || result?.unavailable)"
        class="series-error"
        role="alert"
      >
        <el-icon><Warning /></el-icon>
        <p>{{ error || '当前来源暂时不可用或不支持这组筛选，请切换来源、放宽筛选或稍后重试。' }}</p>
        <el-button text @click="load">重试</el-button>
      </div>
      <p
        v-else-if="
          view === 'discover' && result?.sources.some((source) => source.state === 'unavailable')
        "
        class="partial-notice"
      >
        部分来源暂时不可用，已保留其余来源的结果。可展开下方来源说明查看。
      </p>

      <main class="series-results" :aria-busy="displayLoading" aria-label="剧集结果">
        <div v-if="displayLoading && !displayItems.length" class="series-grid" aria-hidden="true">
          <div v-for="number in 12" :key="number" class="series-skeleton">
            <div></div>
            <span></span>
          </div>
        </div>
        <div
          v-else-if="displayItems.length"
          class="series-grid"
          :class="{ 'is-updating': displayLoading }"
        >
          <article
            v-for="item in displayItems"
            :key="item.id"
            class="series-card"
            :data-series-id="item.id"
          >
            <button
              class="series-card-trigger"
              type="button"
              :aria-label="`查看${item.title}详情`"
              :disabled="displayLoading"
              @click="openDetail(item)"
            >
              <span class="poster-frame"
                ><SeriesPoster :src="item.poster" :title="item.title" /><span
                  class="source-badge"
                  >{{ item.sourceLabel }}</span
                ><span class="score-badge" :class="{ unrated: item.score === null }"
                  ><el-icon v-if="item.score !== null"><StarFilled /></el-icon
                  >{{ ratingText(item) }}</span
                ></span
              >
              <span class="series-card-body"
                ><strong class="series-title">{{ item.title }}</strong
                ><span class="series-meta">{{
                  [item.year, ...item.genres.slice(0, 2)].filter(Boolean).join(' · ') ||
                  (item.cast.length ? item.cast.slice(0, 3).join(' / ') : item.sourceLabel + '收录')
                }}</span
                ><span class="series-extra">{{
                  item.episodes ||
                  (item.heat
                    ? `${formatNumber(item.heat)} ${item.heatLabel}`
                    : item.ratingCount
                      ? `${formatNumber(item.ratingCount)} 人评分`
                      : '查看作品信息')
                }}</span></span
              >
            </button>
            <SeriesLibraryActions
              class="card-library-actions"
              :favorite="library.state(item.id).favorite"
              :watch-status="library.state(item.id).watchStatus"
              :disabled="library.disabled(item.id) || displayLoading"
              @change="library.change(item, $event)"
              @remove="library.remove(item)"
            />
          </article>
        </div>
        <div
          v-else-if="view === 'library' && !libraryLoading && !libraryError"
          class="series-empty"
        >
          <el-icon><Collection /></el-icon>
          <h2>
            {{ libraryKeyword || libraryRegion ? '片单中没有匹配的作品' : '这个片单还没有作品' }}
          </h2>
          <p>点击作品下方的星标收藏，或用时钟图标设置“想看”和“正在观看”。</p>
          <el-button @click="chooseView('discover')">去发现剧集</el-button>
        </div>
        <div
          v-else-if="view === 'discover' && !loading && !error && !result?.unavailable"
          class="series-empty"
        >
          <el-icon><Film /></el-icon>
          <h2>暂时没有匹配的作品</h2>
          <p>
            {{
              [
                'catalog',
                'tencent',
                'youku',
                'mango',
                'iqiyi',
                'netflix',
                'hongguo',
                'hanjutv',
              ].includes(filters.source)
                ? result?.sources.find((source) => source.source === 'catalog')?.message ||
                  '当前片库暂无匹配作品，可查看片库收录情况。'
                : filters.kind === 'ai'
                  ? 'AI剧在评分库的收录较少，可以试试上方平台搜索。'
                  : '试试不限年份、降低评分要求，或更换关键词与来源。'
            }}
          </p>
          <el-button @click="reset">重置筛选</el-button>
        </div>
      </main>

      <footer
        v-if="view === 'library' && libraryResult && libraryResult.total > 0"
        class="results-footer library-footer"
      >
        <span
          >第 {{ libraryPage }} /
          {{ Math.max(1, Math.ceil(libraryResult.total / libraryResult.pageSize)) }} 页</span
        >
        <div class="series-pagination" aria-label="片单翻页">
          <el-tooltip content="上一页" :trigger-keys="[]"
            ><el-button
              class="app-icon-button series-icon"
              :icon="ArrowLeft"
              aria-label="片单上一页"
              :disabled="libraryLoading || libraryPage <= 1"
              @click="turnLibraryPage(-1)"
          /></el-tooltip>
          <el-tooltip content="下一页" :trigger-keys="[]"
            ><el-button
              class="app-icon-button series-icon"
              :icon="ArrowRight"
              aria-label="片单下一页"
              :disabled="libraryLoading || !libraryResult.hasMore"
              @click="turnLibraryPage(1)"
          /></el-tooltip>
        </div>
      </footer>
      <footer v-if="view === 'discover' && result" class="results-footer">
        <div class="source-states">
          <el-tooltip
            v-for="source in result.sources"
            :key="source.source"
            :content="source.message || `${source.label}返回 ${source.count} 部作品`"
            :trigger-keys="[]"
            ><span :class="['source-state', source.state]"
              ><i></i>{{ source.label }}</span
            ></el-tooltip
          >
        </div>
        <div class="series-pagination" aria-label="剧集翻页">
          <el-tooltip content="上一页" :trigger-keys="[]"
            ><span
              ><el-button
                class="app-icon-button series-icon"
                :icon="ArrowLeft"
                aria-label="上一页"
                :disabled="loading || filters.page <= 1"
                @click="turnPage(-1)" /></span></el-tooltip
          ><span>第 {{ result.page }} 页</span
          ><el-tooltip content="下一页" :trigger-keys="[]"
            ><span
              ><el-button
                class="app-icon-button series-icon"
                :icon="ArrowRight"
                aria-label="下一页"
                :disabled="loading || !result.hasMore"
                @click="turnPage(1)" /></span
          ></el-tooltip>
        </div>
      </footer>
      <details v-if="view === 'discover' && result" class="source-details">
        <summary>来源与评分说明</summary>
        <p>{{ result.notice }}</p>
        <p>
          豆瓣新近列表按来源排序；Bangumi 最新列表来自放送日历；TVmaze
          无关键词时展示当日网络播出作品。关键词结果的覆盖范围因来源而异。默认不限年份，可用年份筛选缩小范围；自建片库按实际采集或导入的数据检索。
        </p>
        <p v-for="source in result.sources" :key="source.source">
          <strong>{{ source.label }}</strong> · {{ source.message || '数据已返回'
          }}<span v-if="source.state === 'stale'">（当前为缓存数据）</span>
        </p>
        <p>
          来源：<a href="https://movie.douban.com/tv/" target="_blank" rel="noopener noreferrer"
            >豆瓣</a
          >
          · <a href="https://bgm.tv/" target="_blank" rel="noopener noreferrer">Bangumi</a> ·
          <a href="https://www.tvmaze.com/api" target="_blank" rel="noopener noreferrer"
            >TVmaze（CC BY-SA）</a
          >。未评分显示“暂无评分”，读取失败显示“评分待获取”。
        </p>
      </details>
    </div>

    <el-dialog
      v-model="detailVisible"
      title="作品详情"
      width="620"
      class="series-detail-dialog"
      @closed="selected = null"
    >
      <div v-if="selected" class="series-detail">
        <div class="detail-poster">
          <SeriesPoster :src="selected.poster" :title="selected.title" />
        </div>
        <div class="detail-info">
          <span class="detail-source">{{ selected.sourceLabel }}</span>
          <h2>{{ selected.title }}</h2>
          <p
            v-if="selected.originalTitle && selected.originalTitle !== selected.title"
            class="original-title"
          >
            {{ selected.originalTitle }}
          </p>
          <p class="detail-rating">
            <strong>{{ detail?.score ? detail.score.toFixed(1) : ratingText(selected) }}</strong
            ><span>{{
              selected.source === 'bilibili'
                ? '视频来源不提供统一评分'
                : `${selected.sourceLabel}评分 / 10`
            }}</span>
          </p>
          <p v-if="selected.ratingCount">{{ formatNumber(selected.ratingCount) }} 人评分</p>
          <p v-if="detailLoading" class="detail-hint" role="status">正在补充作品信息…</p>
          <p v-if="detailError" class="detail-hint" role="alert">{{ detailError }}</p>
          <p v-if="selected.catalogFetchedAt" class="detail-hint">
            片库采集于 {{ new Date(selected.catalogFetchedAt).toLocaleString('zh-CN') }}
          </p>
          <dl>
            <template v-if="detail?.year || selected.year"
              ><dt>年份</dt>
              <dd>{{ detail?.year || selected.year }}</dd></template
            ><template v-if="detail?.regions.length || selected.regions.length"
              ><dt>地区</dt>
              <dd>{{ (detail?.regions || selected.regions).join(' / ') }}</dd></template
            ><template v-if="detail?.genres.length || selected.genres.length"
              ><dt>题材</dt>
              <dd>{{ (detail?.genres || selected.genres).join(' / ') }}</dd></template
            ><template v-if="detail?.episodes || selected.episodes"
              ><dt>集数</dt>
              <dd>{{ detail?.episodes || selected.episodes }}</dd></template
            ><template v-if="detail?.duration"
              ><dt>片长</dt>
              <dd>{{ detail.duration }}</dd></template
            ><template v-if="detail?.cast.length || selected.cast.length"
              ><dt>演职员</dt>
              <dd>{{ (detail?.cast || selected.cast).join(' / ') }}</dd></template
            ><template v-if="selected.date"
              ><dt>{{ selected.source === 'tvmaze' ? '播出' : '首播' }}</dt>
              <dd>{{ selected.date }}</dd></template
            >
          </dl>
        </div>
        <p v-if="selected.summary" class="detail-summary">{{ selected.summary }}</p>
        <SeriesLibraryActions
          class="detail-library-actions"
          :favorite="library.state(selected.id).favorite"
          :watch-status="library.state(selected.id).watchStatus"
          :disabled="library.disabled(selected.id)"
          @change="library.change(selected!, $event)"
          @remove="library.remove(selected!)"
        />
      </div>
      <template #footer
        ><el-button @click="detailVisible = false">关闭</el-button
        ><a
          v-if="selected?.url"
          class="source-link"
          :href="selected.url"
          target="_blank"
          rel="noopener noreferrer"
          >前往{{ selected.sourceLabel }} <el-icon><TopRight /></el-icon></a
      ></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  ArrowRight,
  Collection,
  Film,
  Refresh,
  Search,
  StarFilled,
  TopRight,
  Warning,
} from '@element-plus/icons-vue';
import PageBackButton from '@/components/navigation/PageBackButton.vue';
import SeriesPoster from './SeriesPoster.vue';
import SeriesLibraryActions from './SeriesLibraryActions.vue';
import SeriesCatalogInfo from './SeriesCatalogInfo.vue';
import SeriesRegionSelect from './SeriesRegionSelect.vue';
import { useSeriesLibrary } from './useSeriesLibrary';
import {
  fetchSeriesDetail,
  fetchSeriesLibrary,
  searchSeries,
  type SeriesDetail,
  type SeriesItem,
  type SeriesKind,
  type SeriesQuery,
  type SeriesResult,
  type SeriesLibraryResult,
  type SeriesList,
} from '@/api/series';
import { getErrorMessage } from '@/utils/errors';

defineOptions({ name: 'SeriesSearchPage' });
const route = useRoute(),
  router = useRouter();
const library = useSeriesLibrary();
const view = ref<'discover' | 'library'>(route.query.view === 'library' ? 'library' : 'discover');
const libraryLists: { value: SeriesList; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'favorite', label: '收藏' },
  { value: 'want', label: '想看' },
  { value: 'watching', label: '正在观看' },
];
const libraryList = ref<SeriesList>(
  libraryLists.some((list) => list.value === route.query.list)
    ? (route.query.list as SeriesList)
    : 'all',
);
const libraryKeyword = ref(''),
  libraryRegion = ref(
    typeof route.query.libraryRegion === 'string' ? route.query.libraryRegion : '',
  ),
  libraryPage = ref(1),
  libraryLoading = ref(false),
  libraryError = ref(''),
  libraryResult = ref<SeriesLibraryResult | null>(null);
let libraryController: AbortController | undefined;
const displayItems = computed(() =>
  view.value === 'library' ? libraryResult.value?.items || [] : result.value?.items || [],
);
const displayLoading = computed(() =>
  view.value === 'library' ? libraryLoading.value : loading.value,
);
function chooseView(value: 'discover' | 'library') {
  if (view.value === value) return;
  view.value = value;
  void router.replace({
    query: {
      ...route.query,
      view: value,
      list: libraryList.value,
      libraryRegion: libraryRegion.value || undefined,
    },
  });
  if (value === 'library') void loadLibrary();
  else if (!result.value) void load();
}
function chooseList(value: SeriesList) {
  libraryList.value = value;
  libraryPage.value = 1;
  void router.replace({ query: { ...route.query, view: 'library', list: value } });
  void loadLibrary();
}
function chooseLibraryRegion() {
  libraryPage.value = 1;
  void router.replace({
    query: { ...route.query, libraryRegion: libraryRegion.value || undefined },
  });
  void loadLibrary();
}
async function loadLibrary() {
  libraryController?.abort();
  const request = new AbortController();
  libraryController = request;
  libraryLoading.value = true;
  libraryError.value = '';
  try {
    const data = await fetchSeriesLibrary(
      {
        list: libraryList.value,
        keyword: libraryKeyword.value.trim(),
        page: libraryPage.value,
        region: libraryRegion.value,
      },
      request.signal,
    );
    if (!request.signal.aborted) {
      if (libraryPage.value > 1 && data.items.length === 0) {
        libraryPage.value--;
        void loadLibrary();
        return;
      }
      libraryResult.value = data;
    }
  } catch (error) {
    if (!request.signal.aborted) {
      libraryResult.value = null;
      libraryError.value = getErrorMessage(error, '片单读取失败，请重试');
    }
  } finally {
    if (libraryController === request) libraryLoading.value = false;
  }
}
function searchLibrary() {
  libraryPage.value = 1;
  void loadLibrary();
}
function turnLibraryPage(direction: number) {
  libraryPage.value += direction;
  void loadLibrary();
  document.querySelector('.series-page')?.scrollTo({ top: 0, behavior: 'instant' });
}
function reloadCurrent() {
  if (view.value === 'library') {
    void library.refreshStatus();
    void loadLibrary();
  } else void load();
}
watch(library.version, () => {
  if (view.value === 'library') void loadLibrary();
});
const kinds: { value: SeriesKind; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'tv', label: '电视剧' },
  { value: 'short', label: '短剧' },
  { value: 'ai', label: 'AI剧' },
  { value: 'anime', label: '动漫' },
  { value: 'movie', label: '电影' },
  { value: 'variety', label: '综艺' },
  { value: 'documentary', label: '纪录片' },
];
const sources = [
  { value: 'all', label: '聚合来源' },
  { value: 'catalog', label: '自建片库' },
  { value: 'douban', label: '豆瓣' },
  { value: 'bangumi', label: 'Bangumi 动漫' },
  { value: 'tvmaze', label: 'TVmaze 海外' },
  { value: 'bilibili', label: 'B站视频' },
  { value: 'tencent', label: '腾讯视频' },
  { value: 'youku', label: '优酷' },
  { value: 'mango', label: '芒果TV' },
  { value: 'iqiyi', label: '爱奇艺' },
  { value: 'netflix', label: 'Netflix' },
  { value: 'hongguo', label: '红果短剧' },
  { value: 'hanjutv', label: '韩剧TV' },
];
const genres = [
  '剧情',
  '喜剧',
  '爱情',
  '悬疑',
  '犯罪',
  '科幻',
  '奇幻',
  '动作',
  '冒险',
  '历史',
  '战争',
  '家庭',
  '动画',
  '纪录片',
];
const years = Array.from({ length: 21 }, (_, index) => new Date().getFullYear() - index);
const sorts: { value: SeriesQuery['sort']; label: string }[] = [
  { value: 'hot', label: '热门' },
  { value: 'latest', label: '最新' },
  { value: 'rating', label: '高分' },
];
const defaults = (): SeriesQuery => ({
  keyword: '',
  kind: 'all',
  source: 'all',
  sort: 'hot',
  genre: '',
  region: '',
  year: 'all',
  minScore: '0',
  page: 1,
});
const filters = reactive(defaults());
for (const key of [
  'keyword',
  'kind',
  'source',
  'sort',
  'genre',
  'region',
  'year',
  'minScore',
] as const) {
  const value = route.query[key];
  if (typeof value === 'string') Object.assign(filters, { [key]: value });
}
if (
  /^\d+$/.test(String(route.query.page)) &&
  +String(route.query.page) <= 50 &&
  +String(route.query.page) > 0
)
  filters.page = +String(route.query.page);
const loading = ref(false),
  error = ref(''),
  result = ref<SeriesResult | null>(null);
let controller: AbortController | undefined;
const updatedText = computed(() => {
  const dates =
    result.value?.sources
      .map((source) => source.updatedAt)
      .filter((value): value is string => Boolean(value)) || [];
  return dates.length
    ? new Date(dates.sort()[0]).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '';
});
const platformKeyword = computed(() =>
  [filters.kind === 'ai' ? 'AI漫剧' : '短剧', filters.keyword].filter(Boolean).join(' '),
);
const bilibiliSearch = computed(
  () => 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(platformKeyword.value),
);
const douyinSearch = computed(
  () =>
    'https://www.douyin.com/search/' +
    encodeURIComponent((filters.kind === 'ai' ? 'AI短剧 ' : '红果短剧 ') + filters.keyword),
);
async function load() {
  controller?.abort();
  const request = new AbortController();
  controller = request;
  loading.value = true;
  error.value = '';
  const query = { ...filters };
  void router.replace({
    query: {
      ...(typeof route.query.fromCategory === 'string'
        ? { fromCategory: route.query.fromCategory }
        : {}),
      ...Object.fromEntries(
        Object.entries(query)
          .filter(([, value]) => value !== '')
          .map(([key, value]) => [key, String(value)]),
      ),
      view: view.value,
      list: libraryList.value,
      libraryRegion: libraryRegion.value || undefined,
    },
  });
  try {
    const data = await searchSeries(query, request.signal);
    if (!request.signal.aborted) result.value = data;
  } catch (e) {
    if (!request.signal.aborted) {
      result.value = null;
      error.value = getErrorMessage(e, '检索失败，请检查网络后重试');
    }
  } finally {
    if (controller === request) loading.value = false;
  }
}
function apply() {
  filters.page = 1;
  void load();
}
function chooseSource() {
  if (filters.source === 'bilibili' && filters.year === 'recent') filters.year = 'all';
  apply();
}
function chooseKind(kind: SeriesKind) {
  if (filters.kind === kind) return;
  filters.kind = kind;
  if (kind === 'ai' && filters.year === 'recent') filters.year = 'all';
  apply();
}
function chooseSort(sort: SeriesQuery['sort']) {
  if (filters.sort === sort) return;
  filters.sort = sort;
  apply();
}
function reset() {
  Object.assign(filters, defaults());
  apply();
}
function turnPage(direction: number) {
  filters.page += direction;
  void load();
  document.querySelector('.series-page')?.scrollTo({ top: 0, behavior: 'instant' });
}
function ratingText(item: SeriesItem) {
  return item.score !== null
    ? item.score.toFixed(1)
    : item.ratingState === 'unavailable'
      ? '评分待获取'
      : '暂无评分';
}
function formatNumber(number: number) {
  return number >= 10000 ? `${(number / 10000).toFixed(1)}万` : number.toLocaleString('zh-CN');
}
function goBack() {
  void router.push({
    name: 'home',
    query:
      typeof route.query.fromCategory === 'string' ? { category: route.query.fromCategory } : {},
  });
}
const detailVisible = ref(false),
  selected = ref<SeriesItem | null>(null),
  detail = ref<SeriesDetail | null>(null),
  detailLoading = ref(false),
  detailError = ref('');
let detailController: AbortController | undefined;
async function openDetail(item: SeriesItem) {
  detailController?.abort();
  detail.value = null;
  detailError.value = '';
  selected.value = item;
  detailVisible.value = true;
  detailLoading.value = false;
  if (item.source !== 'douban') return;
  const request = new AbortController();
  detailController = request;
  detailLoading.value = true;
  try {
    const data = await fetchSeriesDetail(item.sourceId, request.signal);
    if (!request.signal.aborted && selected.value?.id === item.id) {
      detail.value = data;
      item.score = data.score;
      item.ratingState = data.score === null ? 'unrated' : 'rated';
    }
  } catch (e) {
    if (!request.signal.aborted)
      detailError.value = getErrorMessage(e, '信息暂时无法补全，可前往来源查看。');
  } finally {
    if (detailController === request) detailLoading.value = false;
  }
}
watch(detailVisible, (visible) => {
  if (!visible) detailController?.abort();
});
onMounted(() => {
  void library.refreshStatus();
  if (view.value === 'library') void loadLibrary();
  else void load();
});
onBeforeUnmount(() => {
  controller?.abort();
  detailController?.abort();
  libraryController?.abort();
});
</script>

<style scoped>
.series-page {
  height: var(--app-height, 100dvh);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: clamp(16px, 2.5vw, 32px);
  color: var(--theme-text);
}
.series-content {
  max-width: 1440px;
  min-width: 0;
  margin: 0 auto;
}
.series-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.series-heading {
  flex: 1;
  min-width: 0;
}
h1 {
  font-size: 25px;
  line-height: 1.4;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.6px;
}
.series-heading p {
  color: var(--theme-muted);
  margin: 4px 0 0;
  font-size: 13px;
}
.series-icon.el-button {
  width: 32px;
  min-width: 32px;
  height: 32px;
  margin: 0;
  font-size: 17px;
}
.page-tabs,
.library-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.page-tabs {
  margin: 0 0 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding-bottom: 10px;
}
.page-tabs button,
.library-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--theme-muted);
  border-radius: 7px;
  padding: 6px 10px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.page-tabs button.active,
.library-tabs button.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}
.page-tabs button:hover,
.library-tabs button:hover {
  color: var(--el-color-primary);
}
.page-tabs button:focus-visible,
.library-tabs button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.page-tabs button span,
.library-tabs button span {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}
.library-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--theme-surface);
}
.library-search {
  display: flex;
  align-items: center;
  gap: 6px;
  width: min(280px, 100%);
}
.library-region {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 170px;
}
.library-region label {
  flex-shrink: 0;
  color: var(--theme-muted);
  font-size: 12px;
}
.library-region :deep(.el-select) {
  min-width: 0;
  flex: 1;
}
.library-search .el-input {
  min-width: 0;
}
.library-summary {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  margin: 20px 0 14px;
  font-size: 12px;
}
.library-summary > span {
  color: var(--theme-muted);
  font-size: 11px;
}
.library-footer {
  color: var(--theme-muted);
  font-size: 12px;
}
.library-warning {
  margin-bottom: 14px;
}
.card-library-actions {
  padding: 0 6px 5px 10px;
}
.detail-library-actions {
  grid-column: 1 / -1;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 10px;
}
.discovery-controls {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 16px;
  padding: 18px 20px;
  background: var(--theme-surface);
}
.series-search {
  display: flex;
  gap: 10px;
  max-width: 740px;
}
.series-search .el-input {
  flex: 1;
  min-width: 0;
}
.kind-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 16px 0;
}
.kind-tabs button,
.sort-options button {
  border: 0;
  border-radius: 7px;
  background: transparent;
  height: 30px;
  padding: 0 12px;
  font: inherit;
  font-size: 13px;
  color: var(--theme-muted);
  cursor: pointer;
  white-space: nowrap;
}
.kind-tabs button:hover,
.sort-options button:hover {
  color: var(--ui-accent-text, var(--el-color-primary));
}
.kind-tabs .active,
.sort-options .active {
  background: var(--el-color-primary-light-9);
  color: var(--ui-accent-text, var(--el-color-primary));
  font-weight: 600;
}
button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 3px;
}
.filter-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr)) auto;
  align-items: center;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.filter-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.filter-field label {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--theme-muted);
}
.filter-field .el-select {
  min-width: 0;
  width: 100%;
}
.reset-filters {
  margin: 0;
  padding: 0 6px;
}
.platform-search {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: center;
  padding: 14px 2px 0;
}
.platform-search strong {
  font-size: 13px;
  font-weight: 600;
}
.platform-search p {
  color: var(--theme-muted);
  font-size: 12px;
  line-height: 1.6;
  margin: 4px 0 0;
}
.platform-links {
  display: flex;
  gap: 16px;
  flex-shrink: 0;
}
.platform-links a,
.source-details a {
  color: var(--ui-accent-text, var(--el-color-primary));
  text-decoration: none;
  font-size: 12px;
}
.platform-links a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.results-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 22px 0 16px;
}
.result-count {
  font-size: 13px;
}
.result-count > span {
  color: var(--theme-muted);
  font-size: 11px;
  margin-left: 12px;
}
.sort-options {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.series-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 18px 14px;
}
.series-grid.is-updating {
  opacity: 0.45;
  pointer-events: none;
}
.series-card {
  min-width: 0;
  overflow: hidden;
  background: var(--theme-surface);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  transition:
    box-shadow 160ms,
    border-color 160ms;
}
.series-card-trigger {
  display: block;
  width: 100%;
  overflow: hidden;
  text-align: left;
  padding: 0;
  background: var(--theme-surface);
  color: inherit;
  font: inherit;
  border: 0;
  border-radius: 0;
  cursor: pointer;
  transition:
    transform 160ms,
    box-shadow 160ms,
    border-color 160ms;
}
.series-card-trigger:hover {
  background: var(--el-fill-color-extra-light);
}
.series-card:hover,
.series-card:focus-within {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 8px 22px rgb(15 23 42 / 7%);
}
.poster-frame {
  display: block;
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  overflow: hidden;
}
.poster-frame::after {
  content: '';
  position: absolute;
  inset: 55% 0 0;
  pointer-events: none;
  background: linear-gradient(transparent, rgb(0 0 0 / 42%));
}
.source-badge {
  position: absolute;
  top: 9px;
  left: 9px;
  border-radius: 5px;
  padding: 3px 6px;
  background: rgb(15 23 42 / 65%);
  color: white;
  font-size: 10px;
  line-height: 1.4;
  backdrop-filter: blur(5px);
}
.score-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 1;
  color: #ffda83;
  font-weight: 700;
  font-size: 16px;
  text-shadow: 0 1px 3px #0008;
}
.score-badge.unrated {
  color: #fff;
  font-size: 10px;
  font-weight: 400;
}
.score-badge .el-icon {
  font-size: 13px;
}
.series-card-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px;
}
.series-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  height: 36px;
  line-height: 18px;
}
.series-meta,
.series-extra {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--theme-muted);
  font-size: 11px;
  line-height: 1.5;
}
.series-extra {
  font-size: 10px;
  opacity: 0.85;
}
.series-error {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 18px;
  background: var(--el-color-warning-light-9);
  color: var(--el-text-color-primary);
}
.series-error p {
  flex: 1;
  min-width: 0;
  margin: 0;
  line-height: 1.6;
  font-size: 13px;
}
.series-error > .el-icon {
  color: var(--el-color-warning);
  flex-shrink: 0;
}
.partial-notice {
  font-size: 12px;
  color: var(--theme-muted);
  margin: -4px 0 16px;
}
.series-empty {
  text-align: center;
  padding: 64px 12px;
  color: var(--theme-muted);
}
.series-empty > .el-icon {
  font-size: 40px;
  opacity: 0.6;
}
.series-empty h2 {
  font-size: 16px;
  color: var(--theme-text);
  margin: 16px 0 8px;
}
.series-empty p {
  font-size: 13px;
  margin: 0 0 18px;
  line-height: 1.8;
}
.series-skeleton > div {
  aspect-ratio: 2 / 3;
  border-radius: 12px;
  background: var(--el-fill-color);
  animation: poster-pulse 1.4s ease-in-out infinite alternate;
}
.series-skeleton > span {
  display: block;
  height: 14px;
  border-radius: 4px;
  width: 70%;
  margin: 12px 0;
  background: var(--el-fill-color);
}
.results-footer {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-top: 24px;
}
.source-states {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.source-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--theme-muted);
}
.source-state i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--el-color-success);
}
.source-state.unavailable i,
.source-state.stale i {
  background: var(--el-color-warning);
}
.source-state.unsupported i {
  background: var(--el-text-color-placeholder);
}
.series-pagination {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--theme-muted);
  white-space: nowrap;
}
.source-details {
  margin-top: 18px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 14px;
  color: var(--theme-muted);
  font-size: 12px;
  line-height: 1.8;
}
.source-details summary {
  cursor: pointer;
  width: fit-content;
}
.source-details p {
  margin: 8px 0 0;
}
.series-detail {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.detail-poster {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: 10px;
  overflow: hidden;
}
.detail-source {
  color: var(--ui-accent-text, var(--el-color-primary));
  font-size: 12px;
}
.detail-info h2 {
  font-size: 21px;
  line-height: 1.5;
  margin: 6px 0;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.detail-info p {
  color: var(--theme-muted);
  margin: 5px 0;
  font-size: 12px;
}
.detail-info .detail-rating {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin: 12px 0;
}
.detail-rating strong {
  font-size: 23px;
  color: var(--theme-text);
}
.detail-rating span {
  font-size: 11px;
}
.detail-info dl {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 9px 8px;
  font-size: 12px;
  line-height: 1.6;
}
.detail-info dt {
  color: var(--theme-muted);
}
.detail-info dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.detail-summary {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 13px;
  line-height: 1.9;
  color: var(--theme-muted);
  white-space: pre-line;
}
.source-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  justify-content: center;
  height: 32px;
  border-radius: 8px;
  padding: 0 12px;
  color: #fff;
  background: var(--el-color-primary);
  text-decoration: none;
  font-size: 13px;
  margin-left: 12px;
}
@keyframes poster-pulse {
  to {
    opacity: 0.4;
  }
}
@media (max-width: 1100px) {
  .filter-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px 20px;
  }
  .reset-filters {
    justify-self: end;
  }
}
@media (max-width: 600px) {
  .series-page {
    padding: 16px 12px;
  }
  .series-header {
    gap: 8px;
    margin-bottom: 16px;
  }
  h1 {
    font-size: 21px;
  }
  .series-heading p {
    font-size: 11px;
    line-height: 1.6;
  }
  .discovery-controls {
    padding: 12px;
    border-radius: 12px;
  }
  .series-search {
    gap: 8px;
  }
  .series-search .el-button {
    padding: 0 10px;
  }
  .kind-tabs {
    gap: 3px;
    margin: 12px 0;
  }
  .kind-tabs button {
    padding: 0 8px;
    font-size: 12px;
    height: 28px;
  }
  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding-top: 12px;
  }
  .filter-field {
    gap: 5px;
  }
  .filter-field label {
    font-size: 11px;
  }
  .platform-search {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .platform-links {
    flex-wrap: wrap;
  }
  .results-toolbar {
    margin: 18px 0 12px;
    gap: 8px;
  }
  .result-count {
    font-size: 12px;
  }
  .result-count > span {
    display: none;
  }
  .sort-options {
    gap: 0;
  }
  .sort-options button {
    height: 28px;
    padding: 0 8px;
    font-size: 12px;
  }
  .series-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px 10px;
  }
  .series-card-body {
    padding: 8px;
  }
  .library-controls {
    padding: 10px;
    gap: 10px;
  }
  .library-tabs {
    gap: 2px;
    width: 100%;
  }
  .library-tabs button {
    padding: 6px 8px;
    font-size: 12px;
  }
  .library-search {
    width: auto;
    flex: 1;
    min-width: 120px;
  }
  .library-region {
    width: 128px;
    flex-shrink: 0;
    gap: 6px;
  }
  .card-library-actions {
    padding-left: 8px;
    padding-right: 3px;
  }
  .card-library-actions :deep(.watch-label) {
    font-size: 9px;
  }
  .series-title {
    font-size: 13px;
  }
  .results-footer {
    align-items: flex-start;
  }
  .source-states {
    gap: 7px 10px;
  }
  .series-pagination {
    gap: 3px;
  }
  .series-detail {
    grid-template-columns: 88px minmax(0, 1fr);
    gap: 14px;
  }
  .detail-info h2 {
    font-size: 18px;
  }
  .detail-info dl {
    grid-column: 1 / -1;
  }
  .series-error {
    padding: 10px;
    gap: 6px;
  }
}
@media (max-width: 359px) {
  .series-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (prefers-reduced-motion: reduce) {
  .series-skeleton > div {
    animation: none;
  }
  .series-card-trigger {
    transition: none;
  }
}
</style>
