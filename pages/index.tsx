import { Client } from "@notionhq/client";
import { GetStaticProps, NextPage } from "next";
import prism from "prismjs";
import { useEffect } from "react";
import { QueryDatabaseResponse, ParagraphBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Layout } from "../lib/component/Layout";
import { PostComponent } from "../lib/component/Post";

export type Content =
    | {
            type: "paragraph" | "quote" | "heading_2" | "heading_3";
            text: string | null;
            }
    | {
            type: "code";
            text: "string";
            language: string | null;
    };

export type Post = {
    id: string;
    title: string | null;
    slug: string | null;
    createdTs: string | null;
    lastEditedTs: string | null;
    contents: Content[];
};

interface PageObjectResponse {
    created_time: string;
    last_edited_time: string;
};

const notion = new Client({
    auth: process.env.NOTION_TOKEN,
});

export const getPosts = async (slug?: string) => {
    let database: QueryDatabaseResponse | undefined = undefined;
    if (slug) {
        database = await notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID || "",
        filter: {
            and: [
            {
                property: "Slug",
                rich_text: { equals: slug },
            },
            ],
        },
        });
    } else {
        database = await notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID || "",
        filter: {
            and: [
            {
                property: "Published",
                checkbox: {
                equals: true,
                },
            },
            ],
        },
        sorts: [
            {
                timestamp: "created_time",
                direction: "descending",
            },
        ],
        });
    }
    if (!database) return [];

    const posts: Post[] = [];
    //console.log(database.results);
    const blockResponses = await Promise.all(
        database.results.map((page) => {
            return notion.blocks.children.list({
                block_id: page.id,
            });
        }
    ));
    database.results.forEach((page, index) => {
        if (!("properties" in page)) {
        return {
            props: {
                post: {
                    id: page.id,
                    title: null,
                    slug: null,
                    createdTs: null,
                    ladtEditedTs: null,
                    contents: [],
                },
            },
        };
        }
        let title: string | null = null;
        if (page.properties["Name"].type === "title") {
        //title = page.properties["Name"].title[0]?.plain_text ?? null;
        title = page.properties["Name"].title.shift()?.plain_text ?? null;
        }
        let slug: string | null = null;
        if (page.properties["Slug"].type === "rich_text") {
        slug = page.properties["Slug"].rich_text.shift()?.plain_text ?? null;
        }
        let createdTs: string = "-";
        if ("created_time" in page) {
            createdTs = page.created_time;
        }
        let lastEditedTs: string = "-";
        if ("last_edited_time" in page) {
            lastEditedTs = page.last_edited_time;
        }
        posts.push({
            id: page.id,
            title,
            slug,
            createdTs,
            lastEditedTs,
            contents: [],
        });
    });
    return posts;
};

/*
{
  object: 'block',
  id: '76d8f01c-d1f1-486b-8931-f39b89a5b43e',
  parent: { type: 'page_id', page_id: '5c15a980-e245-46ac-8ccf-c423879a1c0f' },
  created_time: '2024-09-02T05:36:00.000Z',
  last_edited_time: '2024-09-02T05:36:00.000Z',
  created_by: { object: 'user', id: 'ccd390c5-69d9-48fa-b858-9d8d29200f28' },
  last_edited_by: { object: 'user', id: 'ccd390c5-69d9-48fa-b858-9d8d29200f28' },
  has_children: false,
  archived: false,
  in_trash: false,
  type: 'quote',
  quote: {
    rich_text: [
      {
        type: 'text',
        text: { content: 'test quote', link: null },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default'
        },
        plain_text: 'test quote',
        href: null
      }
    ],
    color: 'default'
  }
}
*/

export const getPostContents = async (post: Post) => {
    const blockResponses = await notion.blocks.children.list({
        block_id: post.id,
    });
    const contents: Content[] = [];
    blockResponses.results.forEach((block) => {
        if (!"type in block") {
        return;
        }
        let type: string = '';
        if ("type" in block) {
            type = block.type;
        }
        console.dir(block, {depth: null});
        switch (type) {
        case "paragraph":
            contents.push({
            type: "paragraph",
            // @ts-ignore
            text: block.paragraph.rich_text[0]?.plain_text ?? null,
            });
            break;
        case "heading_2":
            contents.push({
            type: "heading_2",
            // @ts-ignore
            text: block.heading_2.rich_text[0]?.plain_text ?? null,
            });
            break;
        case "heading_3":
            contents.push({
            type: "heading_3",
            // @ts-ignore
            text: block.heading_3.rich_text[0]?.plain_text ?? null,
            });
            break;
        case "quote":
            contents.push({
            type: "quote",
            // @ts-ignore
            text: block.quote.rich_text[0]?.plain_text ?? null,
            });
            break;
        case "code":
            contents.push({
            type: "code",
            // @ts-ignore
            text: block.code.rich_text[0]?.plain_text ?? null,
            // @ts-ignore
            language: block.code.language,
            });
            break;
        }
    });
    return contents;
};

type StaticProps = {
    posts: Post[];
};

export const getStaticProps: GetStaticProps<StaticProps> = async () => {
    const posts = await getPosts();
    const contentsList = await Promise.all(
        posts.map((post) => {
        return getPostContents(post);
        })
    );
    posts.forEach((post, index) => {
        post.contents = contentsList[index];
    });
    return {
        props: { posts },
        revalidate: 60,
    };
};

const Home: NextPage<StaticProps> = ({ posts }) => {
    useEffect(() => {
        prism.highlightAll();
    }, []);

    //console.log(posts);
    return (
        <Layout>
        {posts.map((post) => (
            <PostComponent post={post} key={post.id} />
        ))}
        </Layout>
  );
};

export default Home;
