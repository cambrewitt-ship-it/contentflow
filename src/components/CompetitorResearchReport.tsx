'use client';

import { createContext, useContext, useState } from 'react';
import {
  AlertCircle,
  CalendarPlus,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Heart,
  ImageOff,
  Lightbulb,
  Loader2,
  MessageCircle,
  Music2,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authedFetchJson } from '@/lib/authedFetch';
import { PlatformIcon, formatCount as compact, httpUrl } from '@/components/CompetitorResearchShared';
import type { PostIdea, RankedPost, ResearchReport } from '@/lib/competitor-research/types';

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

// Refs of the post cards shown in this report
const PostRefs = createContext<Set<string>>(new Set());

// Links "P3"-style post refs in the model's text to the post cards above.
function WithRefs({ text }: { text: string }) {
  const refs = useContext(PostRefs);
  const parts = text.split(/\b(P\d{1,2})\b/);
  return (
    <>
      {parts.map((part, i) =>
        refs.has(part) ? (
          <a key={i} href={`#post-${part}`} className="font-medium text-blue-700 hover:underline">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ── Post idea ────────────────────────────────────────────────────────────────

function IdeaCard({ clientId, reportId, idea, index }: { clientId: string; reportId: string; idea: PostIdea; index: number }) {
  const initial = idea.hashtags.length ? `${idea.caption}\n\n${idea.hashtags.join(' ')}` : idea.caption;
  const [caption, setCaption] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Copy failed — select the text and copy it manually');
    }
  };

  const addToCalendar = async () => {
    setAdding(true);
    setError(null);
    try {
      await authedFetchJson(`/api/clients/${clientId}/competitor-research/reports/${reportId}/ideas`, {
        method: 'POST',
        body: { index, caption },
      });
      setAdded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to calendar');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
      <div>
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          {idea.format && (
            <span className="text-[10px] uppercase tracking-wide font-semibold rounded bg-blue-50 text-blue-700 px-1.5 py-0.5">
              {idea.format}
            </span>
          )}
          {idea.platform && (
            <span className="text-[10px] uppercase tracking-wide font-semibold rounded bg-gray-100 text-gray-600 px-1.5 py-0.5">
              {idea.platform}
            </span>
          )}
        </div>
        <h4 className="text-sm font-semibold text-gray-900">{idea.title}</h4>
      </div>
      {idea.visual_direction && (
        <p className="text-xs text-gray-600">
          <span className="font-medium text-gray-800">Shoot: </span>
          {idea.visual_direction}
        </p>
      )}
      {idea.hook && (
        <p className="text-xs text-gray-600">
          <span className="font-medium text-gray-800">Hook: </span>
          {idea.hook}
        </p>
      )}
      <textarea
        value={caption}
        onChange={e => setCaption(e.target.value)}
        className="w-full min-h-[120px] rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-200"
        aria-label={`Caption for ${idea.title}`}
      />
      {idea.inspired_by && (
        <p className="text-[11px] text-gray-400">
          Inspired by <WithRefs text={idea.inspired_by} />
        </p>
      )}
      <div className="flex gap-2 mt-auto">
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button size="sm" className="h-8 text-xs" onClick={addToCalendar} disabled={adding || added || !caption.trim()}>
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : added ? <Check className="h-3.5 w-3.5" /> : <CalendarPlus className="h-3.5 w-3.5" />}
          {added ? 'Added to calendar' : 'Add to calendar'}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Competitor post ──────────────────────────────────────────────────────────

function PostCard({ post, analysis }: { post: RankedPost; analysis?: ResearchReport['top_posts'][number] }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div id={`post-${post.ref}`} className="rounded-lg border border-gray-200 overflow-hidden flex flex-col scroll-mt-24">
      <div className="relative aspect-square bg-gray-100">
        {post.image_url && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt={`Post by @${post.handle}`}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-1">
            <ImageOff className="h-5 w-5" />
            <span className="text-[11px]">Preview unavailable</span>
          </div>
        )}
        <span className="absolute top-2 left-2 rounded bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5">{post.ref}</span>
        <span className="absolute top-2 right-2 rounded bg-white/90 text-gray-800 text-[10px] font-semibold px-1.5 py-0.5 uppercase">
          {post.format}
        </span>
      </div>
      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-gray-900 min-w-0">
            <PlatformIcon platform={post.platform} className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">@{post.handle}</span>
          </span>
          {httpUrl(post.url) && (
            <a href={httpUrl(post.url)!} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-700" aria-label="Open post">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{compact(post.likes)}</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{compact(post.comments)}</span>
          {post.views !== null && <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{compact(post.views)}</span>}
          <span className="font-semibold text-green-700">{post.relative_score}× usual</span>
        </div>
        {post.sound && (
          <p className="flex items-center gap-1 text-[11px] text-gray-500 truncate">
            <Music2 className="h-3 w-3 flex-shrink-0" />{post.sound}
          </p>
        )}
        {analysis?.why_it_works ? (
          <p className="text-xs text-gray-700">{analysis.why_it_works}</p>
        ) : (
          <p className="text-xs text-gray-500 line-clamp-3">{post.caption || 'No caption'}</p>
        )}
        {analysis?.visual_style && (
          <p className="text-[11px] text-gray-500"><span className="font-medium text-gray-700">Look: </span>{analysis.visual_style}</p>
        )}
        {analysis?.hook && (
          <p className="text-[11px] text-gray-500"><span className="font-medium text-gray-700">Hook: </span>{analysis.hook}</p>
        )}
      </div>
    </div>
  );
}

// ── Report ───────────────────────────────────────────────────────────────────

export default function CompetitorResearchReport({
  clientId,
  reportId,
  report,
  warnings,
  meta,
  onDelete,
}: {
  clientId: string;
  reportId: string;
  report: ResearchReport;
  warnings: string[];
  meta: { accounts: number; posts: number; createdAt: string };
  onDelete: () => void;
}) {
  const analysisByRef = new Map(report.top_posts.map(t => [t.ref, t]));
  // Analysed posts first, in the order the model ranked them
  const posts = [...report.posts].sort((a, b) => {
    const ia = report.top_posts.findIndex(t => t.ref === a.ref);
    const ib = report.top_posts.findIndex(t => t.ref === b.ref);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <PostRefs.Provider value={new Set(report.posts.map(p => p.ref))}>
    <div className="space-y-6">
      {/* Summary */}
      <section className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Summary</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {new Date(meta.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
              {meta.posts} posts from {meta.accounts} account{meta.accounts === 1 ? '' : 's'}
              {report.trend_sources.length > 0 && ` · ${report.trend_sources.length} web sources`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete report">
            <Trash2 className="h-4 w-4 text-gray-400" />
          </Button>
        </div>
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line"><WithRefs text={report.summary} /></p>
        {warnings.length > 0 && (
          <div className="rounded-md bg-amber-50 px-3 py-2 space-y-1">
            {warnings.map(w => (
              <p key={w} className="flex items-start gap-1.5 text-xs text-amber-800">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />{w}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Post ideas */}
      {report.post_ideas.length > 0 && (
        <Section title="Post ideas for you" icon={<Lightbulb className="h-4 w-4 text-amber-500" />}>
          <div className="grid gap-4 md:grid-cols-2">
            {report.post_ideas.map((idea, i) => (
              <IdeaCard key={`${reportId}-${i}`} clientId={clientId} reportId={reportId} idea={idea} index={i} />
            ))}
          </div>
        </Section>
      )}

      {/* Top posts */}
      {posts.length > 0 && (
        <Section title="Top-performing posts" icon={<TrendingUp className="h-4 w-4 text-green-600" />}>
          <p className="text-xs text-gray-500 -mt-2">Ranked by how far each post beat its account&apos;s usual engagement.</p>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {posts.map(p => (
              <PostCard key={`${p.platform}-${p.id}`} post={p} analysis={analysisByRef.get(p.ref)} />
            ))}
          </div>
        </Section>
      )}

      {/* What's working */}
      <div className="grid gap-6 md:grid-cols-2">
        {report.visual_trends.length > 0 && (
          <Section title="Visual styles that work" icon={<Sparkles className="h-4 w-4 text-violet-500" />}>
            <ul className="space-y-3">
              {report.visual_trends.map(t => (
                <li key={t.title}>
                  <p className="text-sm font-medium text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5"><WithRefs text={t.description} /></p>
                  {t.examples.length > 0 && (
                    <p className="text-[11px] text-gray-400 mt-0.5">See <WithRefs text={t.examples.join(', ')} /></p>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {report.caption_patterns.length > 0 && (
          <Section title="Caption patterns" icon={<MessageCircle className="h-4 w-4 text-blue-500" />}>
            <ul className="space-y-3">
              {report.caption_patterns.map(c => (
                <li key={c.title}>
                  <p className="text-sm font-medium text-gray-900">{c.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5"><WithRefs text={c.description} /></p>
                  {c.example && <p className="text-xs text-gray-500 italic mt-1 border-l-2 border-gray-200 pl-2">{c.example}</p>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {report.engagement_tactics.length > 0 && (
          <Section title="Engagement tactics" icon={<Heart className="h-4 w-4 text-rose-500" />}>
            <ul className="space-y-3">
              {report.engagement_tactics.map(t => (
                <li key={t.title}>
                  <p className="text-sm font-medium text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5"><WithRefs text={t.description} /></p>
                  {t.evidence && <p className="text-[11px] text-gray-400 mt-0.5"><WithRefs text={t.evidence} /></p>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {report.trending_formats.length > 0 && (
          <Section title="Trending right now" icon={<TrendingUp className="h-4 w-4 text-orange-500" />}>
            <ul className="space-y-3">
              {report.trending_formats.map(t => (
                <li key={t.title}>
                  <p className="text-sm font-medium text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{t.description}</p>
                  {t.how_to_use && <p className="text-xs text-gray-800 mt-1"><span className="font-medium">Try: </span>{t.how_to_use}</p>}
                  {t.sources.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-1">
                      {t.sources.filter(s => httpUrl(s)).map(s => (
                        <a key={s} href={s} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline truncate max-w-[220px]">
                          {safeHost(s)}
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {report.opportunities.length > 0 && (
        <Section title="Opportunities for you" icon={<Lightbulb className="h-4 w-4 text-green-600" />}>
          <ul className="space-y-2 list-disc pl-5">
            {report.opportunities.map(o => (
              <li key={o} className="text-sm text-gray-700"><WithRefs text={o} /></li>
            ))}
          </ul>
        </Section>
      )}

      {/* Benchmarks */}
      {report.account_stats.length > 0 && (
        <Section title="Account benchmarks" icon={<TrendingUp className="h-4 w-4 text-gray-500" />}>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-4 font-medium">Account</th>
                  <th className="py-2 pr-4 font-medium text-right">Followers</th>
                  <th className="py-2 pr-4 font-medium text-right">Posts/wk</th>
                  <th className="py-2 pr-4 font-medium text-right">Avg eng.</th>
                  <th className="py-2 pr-4 font-medium">Formats</th>
                  <th className="py-2 pr-4 font-medium text-right">Caption words</th>
                  <th className="py-2 pr-4 font-medium text-right">Hashtags</th>
                  <th className="py-2 font-medium">Busiest days</th>
                </tr>
              </thead>
              <tbody>
                {report.account_stats.map(s => (
                  <tr key={`${s.platform}-${s.handle}`} className="border-b border-gray-50 text-gray-700">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <PlatformIcon platform={s.platform} className="h-3.5 w-3.5" />@{s.handle}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">{compact(s.followers)}</td>
                    <td className="py-2 pr-4 text-right">{s.posts_per_week ?? '—'}</td>
                    <td className="py-2 pr-4 text-right">{s.avg_engagement_rate !== null ? `${s.avg_engagement_rate}%` : '—'}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {Object.entries(s.format_mix).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(' · ')}
                    </td>
                    <td className="py-2 pr-4 text-right">{s.avg_caption_words}</td>
                    <td className="py-2 pr-4 text-right">{s.avg_hashtags}</td>
                    <td className="py-2 whitespace-nowrap">{s.top_days.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400">
            Instagram engagement = likes + comments ÷ followers. TikTok engagement = likes + comments + shares + saves ÷ views.
          </p>
        </Section>
      )}

      {report.trend_sources.length > 0 && (
        <details className="rounded-xl border border-gray-200 bg-white px-5 py-3">
          <summary className="text-xs font-medium text-gray-600 cursor-pointer">Web sources ({report.trend_sources.length})</summary>
          <ul className="mt-2 space-y-1">
            {report.trend_sources.filter(s => httpUrl(s.url)).map(s => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                  {s.title || safeHost(s.url)}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
    </PostRefs.Provider>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
