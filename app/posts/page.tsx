import PostsTable from "@/components/posts/post-table"

const PostPage = () => {
    return (
        <main className="mx-auto max-w-4xl py-4 flex min-h-screen flex-col items-center">
            <div className="w-full max-w-7xl">
                {/* <h1 className="text-3xl font-bold mb-8">Post</h1> */}
                <PostsTable />
            </div>
        </main>
    )
}

export default PostPage