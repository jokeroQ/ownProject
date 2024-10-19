export interface Menu {
    id?:number,
    index: string;
    title: string;
}
export const menuList: Menu[] = [
    {
        index: '1',
        title: '学习网站',
    },
    {
        index: '2',
        title: '视频网站'
    },
    {
        index: '3',
        title: '图片素材'
    },
    {
        index: '4',
        title: '常用工具'
    },
    {
        index: '5',
        title: '有趣功能点尝试'
    },
]

const mottoList = [
    '凡所有相，皆为虚妄。若见诸相非相，即见如来',
    '不取于相，如如不动',
    '万法皆空，因果不空',
    '悲凉才是人生常态，快乐才是意外',
];

export const getMotto = () => {
    const random = Math.floor(Math.random() * mottoList.length);
    return mottoList[random];
};