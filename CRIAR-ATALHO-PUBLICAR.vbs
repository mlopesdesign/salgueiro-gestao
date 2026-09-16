' Cria o atalho "Publicar Salgueiro" na Area de Trabalho.
' Roda uma vez e se apaga da lista de tarefas do Marcio: depois disso a
' publicacao vira um icone fixo na area de trabalho.
Set sh = CreateObject("WScript.Shell")
desktop = sh.SpecialFolders("Desktop")
alvo = "E:\Projetos\LOJA FISICA SALGUEIRO V2\push-github.bat"
pasta = "E:\Projetos\LOJA FISICA SALGUEIRO V2"

Set lnk = sh.CreateShortcut(desktop & "\Publicar Salgueiro.lnk")
lnk.TargetPath = alvo
lnk.WorkingDirectory = pasta
lnk.WindowStyle = 1
lnk.Description = "Commita, versiona e publica a release do Salgueiro Gestao no GitHub"
lnk.IconLocation = pasta & "\src\img\icon.ico, 0"
lnk.Save

MsgBox "Pronto." & vbCrLf & vbCrLf & _
       "O atalho ""Publicar Salgueiro"" esta na sua Area de Trabalho." & vbCrLf & _
       "A partir de agora, publicar release e um duplo clique nele.", _
       64, "Salgueiro Gestao"
