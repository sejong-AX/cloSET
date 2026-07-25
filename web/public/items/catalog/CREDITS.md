# 의류 단품 컷 출처

cloSET 은 인식한 옷을 **그 옷만 담긴 이미지 한 장**으로 보여준다.
종류·색이 맞는 실제 사진이 있으면 먼저 쓰고(`web/lib/garment-catalog.ts`),
없을 때만 `web/lib/garment-art.ts` 가 비슷한 그림을 만든다.

아래 사진은 **Wikimedia Commons** 의 자유 라이선스 이미지를 받아
`scripts/make_catalog.py` 로 배경을 지우고(테두리에서 이어진 단색만 알파 처리) 잘라낸 것이다.
각 파일의 라이선스는 아래 원본 문서에서 확인할 수 있다.

| 파일 | 원본 (Wikimedia Commons) |
|------|--------------------------|
| `boots-black.png` | [Black high-heeled boots in synthetic leather 1.jpg](https://commons.wikimedia.org/wiki/File:Black_high-heeled_boots_in_synthetic_leather_1.jpg) |
| `hoodie-black.png` | [Herlandsem.jpg](https://commons.wikimedia.org/wiki/File:Herlandsem.jpg) |
| `jeans-indigo.png` | [Blauwe spijkerbroek met geel sierstiksel, Hugo Boss, objectnr 73056.JPG](https://commons.wikimedia.org/wiki/File:Blauwe_spijkerbroek_met_geel_sierstiksel,_Hugo_Boss,_objectnr_73056.JPG) |
| `pants-black.png` | [Byxor - Nordiska museet - NM.0111075A (2).jpg](https://commons.wikimedia.org/wiki/File:Byxor_-_Nordiska_museet_-_NM.0111075A_(2).jpg) |
| `shirt-blue.png` | [Blue Business Shirt.jpg](https://commons.wikimedia.org/wiki/File:Blue_Business_Shirt.jpg) |
| `shirt-cream.png` | [Camisade puño doble.jpg](https://commons.wikimedia.org/wiki/File:Camisade_puño_doble.jpg) |
| `shirt-grey.png` | [Uniformhemd van de ambulance GGD, objectnr 67996-4.JPG](https://commons.wikimedia.org/wiki/File:Uniformhemd_van_de_ambulance_GGD,_objectnr_67996-4.JPG) |
| `sweat-black.png` | [Dunkles Sweatshirt mit hellem Ornament.jpg](https://commons.wikimedia.org/wiki/File:Dunkles_Sweatshirt_mit_hellem_Ornament.jpg) |
| `tee-black.png` | [Camiseta-negra.jpg](https://commons.wikimedia.org/wiki/File:Camiseta-negra.jpg) |
| `tee-charcoal.png` | [BlueIEditShirt-plainBackground.jpeg](https://commons.wikimedia.org/wiki/File:BlueIEditShirt-plainBackground.jpeg) |

`items/flat/*.png` 는 프로젝트 초기부터 쓰던 단품 컷이다(같은 규칙으로 사용).

새 사진을 추가할 때:

```bash
python3 scripts/make_catalog.py <원본.jpg> <이름> --kind tee   # 배경 제거 + 대표색 측정
python3 scripts/make_catalog.py --measure web/public/items/catalog/*.png  # 색만 다시 측정
```

출력된 한 줄을 `web/lib/garment-catalog.ts` 의 `CATALOG` 에 넣으면 끝이다.
