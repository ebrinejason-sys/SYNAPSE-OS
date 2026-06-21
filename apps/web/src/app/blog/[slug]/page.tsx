import { ComingSoon } from '../../../components/ComingSoon'

export const metadata = { title: 'Article · SynapseOS' }

export default function BlogPostPage() {
  return (
    <ComingSoon
      title="Article coming soon"
      subtitle="This post is not published yet. Browse the blog for available articles, or subscribe to know when new writing goes live."
      backHref="/blog"
      backLabel="Back to blog"
      showNotify
    />
  )
}
