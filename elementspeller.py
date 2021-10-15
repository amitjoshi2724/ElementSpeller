symbols = "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn" + \
" Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb" + \
" Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl" + \
"Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl" + \
" Mc Lv Ts Og"
splittedSymbols = symbols.split()
symbolDict = dict()
for symbol in splittedSymbols:
	symbolDict[symbol.lower()] = symbol
def findSymbolsHelper(word,phrase):
	origWord = word
	word = word.lower()
	tfdp = [False] * (len(word) + 1) 
	tfdp[-1] = True
	dp = [None] * (len(word) + 1)
	dp[-1] = ("", None)
	for i in range(len(word)-1, -1,-1):
		for endIndex in range(i + 1, min(len(dp), i + 1 + 3)):
			substring = word[i:endIndex]
			if tfdp[endIndex] == True and substring in symbolDict:
				dp[i] = (symbolDict[substring], endIndex)
				tfdp[i] = True
				break
	if tfdp[i] == False:
		print ("no element spelling exists for: " + phrase)
		exit()
	else:
		res = list()
		curIndex = 0
		while curIndex is not None:
			res.append(dp[curIndex][0])
			curIndex = dp[curIndex][1]
		return ("".join(res))
def findSymbols(phrase):
	splitted = phrase.split(" ")
	res = list()
	for word in splitted:
		res.append(findSymbolsHelper(word,phrase))
	return (" ".join(res))
word = input("word to element spell?: ")
print (findSymbols(word))


