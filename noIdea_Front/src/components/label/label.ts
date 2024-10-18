export interface labelType {
  icon: string;
  title: string;
  targetUrl: string;
  type: string;
  id: string;
}

export const labelData: labelType[] = [
  {
    icon: '&#xe61a;',
    title: 'github',
    targetUrl: 'https://github.com/alanhzw/WarblerHomepage',
    type: '1',
    id: 'github1',
  },
  {
    icon: '&#xe60b;',
    title: 'gitee',
    targetUrl: 'https://gitee.com/hzw_0174/WarblerHomepage',
    type: '1',
    id: 'gitee',
  },
  {
    icon: '&#xe603;',
    title: '掘金',
    targetUrl: 'https://juejin.cn/post/6963945204965441550',
    type: '1',
    id: 'juejin',
  },
  {
    icon: ' &#xe640;',
    title: '个人博客',
    targetUrl: 'https://www.duwanyu.com',
    type: '1',
    id: 'blog',
  },
  {
    icon: ' &#xe640;',
    title: 'b站',
    targetUrl: 'https://www.bilibili.com/',
    type: '2',
    id: 'blib',
  },
  {
    icon: ' &#xe640;',
    title: '腾讯视频',
    targetUrl: 'https://v.qq.com/',
    type: '2',
    id: 'tencent'
  },
  {
    icon: '',
    title: '阿里巴巴矢量库',
    targetUrl: 'https://www.iconfont.cn/collections/index?spm=a313x.collections_index.i1.da2e3581b.56063a81HWsFks&type=1',
    type: '3',
    id: 'icon'
  },
  {
    icon: ' &#xe640;',
    title: 'ChatGPT',
    targetUrl: 'https://chat.openai.com/chat',
    type: '4',
    id: 'gpt'
  },
  {
    icon: ' &#xe640;',
    title: 'github',
    targetUrl: 'https://github.com/search?q=react&type=repositories',
    type: '4',
    id: 'github2'
  },
  {
    icon: ' &#xe640;',
    title: '签名版',
    targetUrl: '/signPad',
    type: '5',
    id: 'signFunction'
  },
  {
    icon: ' &#xe640;',
    title: '聊天框样式',
    targetUrl: '/chat',
    type: '5',
    id: 'chatFunction'
  },
]